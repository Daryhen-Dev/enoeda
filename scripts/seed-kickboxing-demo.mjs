#!/usr/bin/env node
/**
 * One-off demo seed for the Kickboxing group of Carapungo (October 2026).
 *
 * Fills what the UI needs to look alive without touching existing rows:
 *   1. Adds every active monthly Kickboxing student to the October series
 *      roster (the DB trigger validates branch/active/monthly eligibility).
 *   2. Marks attendance for every October occurrence already in the past
 *      (Sunday, Tuesday and Thursday at 13:00), with realistic absences.
 *   3. Registers monthly payments so the payment console shows a mix of
 *      up-to-date, overdue and never-paid enrollments.
 *
 * Never rewrites existing data. It aborts if attendance for those
 * occurrences already exists, so run the generated rollback first:
 *
 *   node scripts/seed-kickboxing-demo.mjs
 *
 * The rollback SQL with the exact ids it created is written next to this
 * script as scripts/rollback-kickboxing-demo-<run id>.sql.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

const BRANCH_NAME = "Carapungo";
const DISCIPLINE_CODE = "kickboxing";
const SERIES_PERIOD_MONTH = "2026-10-01";
const MONTHLY_FEE = "35.00";
const THROUGH_DATE = "2026-10-27"; // "today" when the seed was run

// Payment cohorts, assigned over the roster ordered by surname:
//   [0, 8)   paid October            -> next due 2026-11-05 (9 days away)
//   [8, 10)  prepaid through November -> next due 2026-12-05
//   [10, 14) last paid September     -> next due 2026-10-05 (22 days overdue)
//   [14, …)  never paid              -> no due date, "Sin pagos registrados"
const COHORTS = [
  { from: 0, to: 8, months: ["2026-10"] },
  { from: 8, to: 10, months: ["2026-09", "2026-10", "2026-11"] },
  { from: 10, to: 14, months: ["2026-09"] },
];

// Attendance profile by roster position: regulars, irregulars, drop-offs.
const ATTENDANCE_PROFILES = [
  { to: 10, rate: 0.92 },
  { to: 15, rate: 0.6 },
  { to: Number.POSITIVE_INFINITY, rate: 0.3 },
];

const ABSENCE_OBSERVATIONS = [
  "Avisó que no podía asistir",
  "Lesión en el tobillo",
  "Viaje familiar",
  "Reposo por enfermedad",
];

const MONTH_LABELS = {
  "2026-09": "septiembre 2026",
  "2026-10": "octubre 2026",
  "2026-11": "noviembre 2026 (adelanto)",
};

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
  const match = envFile.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
  if (!match) throw new Error("DATABASE_URL not found in .env.local");
  return match[1].trim();
}

/** Deterministic 32-bit hash so re-runs produce the same attendance. */
function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function periodFor(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const endMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const endYear = monthNumber === 12 ? year + 1 : year;
  return {
    period_start: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
    period_end: `${endYear}-${String(endMonth).padStart(2, "0")}-01`,
  };
}

/** October occurrences of the group, from the 1st through THROUGH_DATE. */
function occurrences(scheduledClasses, year, month, throughDate) {
  const result = [];
  const lastThrough = Number(throughDate.slice(8, 10));
  for (let day = 1; day <= lastThrough; day += 1) {
    const isoDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const scheduledClass = scheduledClasses.find((row) => row.day_of_week === isoDay);
    if (!scheduledClass) continue;
    result.push({
      scheduled_class_id: scheduledClass.id,
      session_date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }
  return result;
}

function attendanceRate(position) {
  const profile = ATTENDANCE_PROFILES.find((entry) => position < entry.to);
  return profile.rate;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const client = new pg.Client({
    connectionString: getDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const rows = async (sql, params) => (await client.query(sql, params)).rows;

  const [branch] = await rows(
    "SELECT id, name, payment_due_day FROM public.branches WHERE name = $1 AND is_active",
    [BRANCH_NAME]
  );
  if (!branch) throw new Error(`Active branch not found: ${BRANCH_NAME}`);

  const [discipline] = await rows(
    "SELECT id, name FROM public.disciplines WHERE code = $1 AND is_active",
    [DISCIPLINE_CODE]
  );
  if (!discipline) throw new Error(`Active discipline not found: ${DISCIPLINE_CODE}`);

  const [series] = await rows(
    `SELECT id, name, period_month::text AS period_month
       FROM public.class_series
      WHERE branch_id = $1 AND discipline_id = $2 AND period_month = $3::date
      ORDER BY created_at
      LIMIT 1`,
    [branch.id, discipline.id, SERIES_PERIOD_MONTH]
  );
  if (!series) throw new Error(`Series not found for period ${SERIES_PERIOD_MONTH}`);

  const scheduledClasses = await rows(
    `SELECT id, day_of_week, start_time::text AS start_time
       FROM public.scheduled_classes
      WHERE series_id = $1 AND is_active
      ORDER BY day_of_week`,
    [series.id]
  );
  if (scheduledClasses.length === 0) throw new Error("Series has no active scheduled classes");

  const rosterStudents = await rows(
    `SELECT s.id, s.first_name, s.surname, sd.id AS student_discipline_id
       FROM public.students s
       JOIN public.student_disciplines sd ON sd.student_id = s.id
      WHERE s.branch_id = $1
        AND sd.discipline_id = $2
        AND s.is_active
        AND sd.is_active
        AND sd.billing_mode = 'monthly'
      ORDER BY s.surname, s.first_name`,
    [branch.id, discipline.id]
  );
  if (rosterStudents.length === 0) throw new Error("No active monthly students to seed");

  const [admin] = await rows(
    `SELECT ur.user_id
       FROM public.user_roles ur
      WHERE ur.branch_id = $1 AND ur.role = 'admin' AND ur.revoked_at IS NULL
      ORDER BY ur.assigned_at
      LIMIT 1`,
    [branch.id]
  );
  if (!admin) throw new Error("Branch has no active admin to record payments");

  const [teacher] = await rows(
    `SELECT teacher_id FROM public.branch_default_teachers WHERE branch_id = $1`,
    [branch.id]
  );
  const markedBy = teacher?.teacher_id ?? admin.user_id;

  const sessions = occurrences(scheduledClasses, 2026, 10, THROUGH_DATE);
  const sessionDates = sessions.map((row) => row.session_date);
  const scheduledClassIds = [...new Set(sessions.map((row) => row.scheduled_class_id))];

  const existing = await rows(
    `SELECT count(*)::int AS total
       FROM public.attendance
      WHERE scheduled_class_id = ANY($1::uuid[])
        AND session_date = ANY($2::date[])`,
    [scheduledClassIds, sessionDates]
  );
  if (existing[0].total > 0) {
    throw new Error(
      `Attendance already exists for ${existing[0].total} rows in these occurrences. ` +
        "Run the previous rollback SQL first."
    );
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const rosterIds = [];
  const attendanceIds = [];
  const paymentIds = [];

  await client.query("BEGIN");
  try {
    // 1. Roster: the series had a single student; attendance requires the roster.
    for (const student of rosterStudents) {
      const inserted = await rows(
        `INSERT INTO public.class_series_students (series_id, student_id, added_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (series_id, student_id) DO NOTHING
         RETURNING id`,
        [series.id, student.id, admin.user_id]
      );
      if (inserted[0]) rosterIds.push(inserted[0].id);
    }

    // 2. Attendance for every past occurrence of the group.
    for (const [position, student] of rosterStudents.entries()) {
      const rate = attendanceRate(position);
      for (const session of sessions) {
        const seed = hash(`${student.id}|${session.session_date}`);
        const attended = seed % 100 < Math.round(rate * 100);
        let observation = null;
        if (!attended && seed % 3 === 0) {
          observation = ABSENCE_OBSERVATIONS[seed % ABSENCE_OBSERVATIONS.length];
        } else if (attended && seed % 17 === 0) {
          observation = "Llegó 10 minutos tarde";
        }

        const inserted = await rows(
          `INSERT INTO public.attendance
             (scheduled_class_id, session_date, student_id, attended, observation, marked_by)
           VALUES ($1, $2::date, $3, $4, $5, $6)
           RETURNING id`,
          [session.scheduled_class_id, session.session_date, student.id, attended, observation, markedBy]
        );
        attendanceIds.push(inserted[0].id);
      }
    }

    // 3. Monthly payments with distinct due-date outcomes.
    for (const [position, student] of rosterStudents.entries()) {
      const cohort = COHORTS.find((entry) => position >= entry.from && position < entry.to);
      if (!cohort) continue;
      for (const [monthIndex, month] of cohort.months.entries()) {
        const { period_start, period_end } = periodFor(month);
        const monthNumber = Number(period_end.slice(5, 7));
        const startMonthNumber = Number(period_start.slice(5, 7));
        const monthsCovered = (Number(period_end.slice(0, 4)) - Number(period_start.slice(0, 4))) * 12 + monthNumber - startMonthNumber;
        const paymentDate = month === "2026-11"
          ? "2026-10-20"
          : `${month}-${String(4 + ((position + monthIndex) % 3)).padStart(2, "0")}`;

        const inserted = await rows(
          `INSERT INTO public.payments
             (student_discipline_id, amount, months_covered, period_start, period_end, payment_date, recorded_by, note)
           VALUES ($1, $2::numeric, $3, $4::date, $5::date, $6::date, $7, $8)
           RETURNING id`,
          [
            student.student_discipline_id,
            MONTHLY_FEE,
            monthsCovered,
            period_start,
            period_end,
            paymentDate,
            admin.user_id,
            `Mensual ${MONTH_LABELS[month]}`,
          ]
        );
        paymentIds.push(inserted[0].id);
      }
    }

    if (dryRun) {
      // Validate every statement and the DB constraints, then leave no trace.
      const planning = await rows(
        `SELECT
           (SELECT count(*)::int FROM public.attendance
             WHERE scheduled_class_id = ANY($1::uuid[]) AND session_date = ANY($2::date[])) AS attendance_rows,
           (SELECT count(*)::int FROM public.payments WHERE id = ANY($3::uuid[])) AS payments`,
        [scheduledClassIds, sessionDates, paymentIds]
      );
      console.log(`Dry run:     ${JSON.stringify(planning[0])} (rolled back)`);
      await client.query("ROLLBACK");
      await client.end();
      return;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  const uuidList = (ids) => (ids.length === 0 ? "ARRAY[]::uuid[]" : `ARRAY['${ids.join("','")}']::uuid[]`);
  const rollbackPath = join(SCRIPT_DIR, `rollback-kickboxing-demo-${runId}.sql`);
  writeFileSync(
    rollbackPath,
    `-- Rollback for scripts/seed-kickboxing-demo.mjs (run id ${runId}).
-- Removes exactly the rows that seed created. Safe to run once.
BEGIN;

DELETE FROM public.payments WHERE id = ANY(${uuidList(paymentIds)});
DELETE FROM public.payment_audit_entries
 WHERE payment_id = ANY(${uuidList(paymentIds)});

DELETE FROM public.attendance WHERE id = ANY(${uuidList(attendanceIds)});

DELETE FROM public.class_series_students WHERE id = ANY(${uuidList(rosterIds)});

COMMIT;
`,
    "utf8"
  );

  const summary = await rows(
    `SELECT
       (SELECT count(*)::int FROM public.class_series_students WHERE series_id = $1) AS roster,
       (SELECT count(*)::int FROM public.attendance WHERE scheduled_class_id = ANY($2::uuid[]) AND session_date = ANY($3::date[])) AS attendance_rows,
       (SELECT count(*)::int FROM public.attendance WHERE scheduled_class_id = ANY($2::uuid[]) AND session_date = ANY($3::date[]) AND attended) AS attended_rows,
       (SELECT count(*)::int FROM public.payments WHERE id = ANY($4::uuid[])) AS payments`,
    [series.id, scheduledClassIds, sessionDates, paymentIds]
  );

  const dueDates = await rows(
    `SELECT sd.next_due_date::text AS next_due_date, count(*)::int AS students
       FROM public.student_disciplines sd
       JOIN public.students s ON s.id = sd.student_id
      WHERE s.branch_id = $1 AND sd.discipline_id = $2 AND sd.is_active
      GROUP BY sd.next_due_date
      ORDER BY sd.next_due_date NULLS LAST`,
    [branch.id, discipline.id]
  );

  console.log(`Branch:      ${branch.name} (${branch.id})`);
  console.log(`Series:      ${series.name} (${series.id})`);
  console.log(`Sessions:    ${sessions.length} (${sessionDates[0]} .. ${sessionDates.at(-1)})`);
  console.log(`Summary:     ${JSON.stringify(summary[0])}`);
  console.log("Due dates:");
  for (const row of dueDates) {
    console.log(`  ${row.next_due_date ?? "sin pagos"} -> ${row.students} alumnos`);
  }
  console.log(`Rollback:    ${rollbackPath}`);

  await client.end();
}

main().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exit(1);
});
