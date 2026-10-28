#!/usr/bin/env node
/**
 * One-off demo seed for conduct records of the Carapungo Kickboxing group.
 *
 * Adds warnings, pending fines, a couple of paid fines and one voided
 * record, so the conduct page, the per-student status strip and the
 * student history show every state the DB allows:
 *
 *   warning  -> status 'issued', amount NULL
 *   fine     -> status 'pending', amount > 0
 *   fine     -> status 'paid', requires paid_at + paid_by
 *   voided   -> voided_at + voided_by + void_reason, never paid
 *
 * It aborts when the branch already has conduct records, so run the
 * generated rollback first:
 *
 *   node scripts/seed-kickboxing-conduct.mjs
 *   node scripts/seed-kickboxing-conduct.mjs --dry-run   # validates, rolls back
 *
 * The rollback SQL with the exact ids it created is written next to this
 * script as scripts/rollback-kickboxing-conduct-<run id>.sql.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

const BRANCH_NAME = "Carapungo";
const DISCIPLINE_CODE = "kickboxing";

/**
 * One row per record. `position` is the student's index in the roster
 * ordered by surname, the same order the attendance seed uses, so the
 * students who skip classes are also the ones collecting warnings.
 */
const RECORDS = [
  // Llamados de atención.
  {
    position: 10,
    kind: "warning",
    incident_date: "2026-10-02",
    reason: "Llegó 15 minutos tarde a la clase sin justificación.",
  },
  {
    position: 11,
    kind: "warning",
    incident_date: "2026-10-06",
    reason: "Se presentó sin el uniforme completo de la disciplina.",
  },
  {
    position: 12,
    kind: "warning",
    incident_date: "2026-10-08",
    reason: "Usó el celular durante la clase después de dos advertencias del profesor.",
  },
  {
    position: 13,
    kind: "warning",
    incident_date: "2026-10-11",
    reason: "Faltó a la clase sin avisar al profesor con anticipación.",
  },
  {
    position: 14,
    kind: "warning",
    incident_date: "2026-10-15",
    reason: "Interrumpió la clase con actitud irrespetuosa hacia un compañero.",
  },
  {
    position: 15,
    kind: "warning",
    incident_date: "2026-10-18",
    reason: "No trajo el equipo de protección requerido para el trabajo de contacto.",
  },
  {
    position: 16,
    kind: "warning",
    incident_date: "2026-10-22",
    reason: "Ingresó a la sala fuera del horario asignado a su grupo.",
  },
  {
    position: 18,
    kind: "warning",
    incident_date: "2026-10-25",
    reason: "Faltó a dos clases consecutivas sin comunicación con la sucursal.",
  },
  // Multas pendientes de pago.
  {
    position: 11,
    kind: "fine",
    amount: "2.00",
    incident_date: "2026-10-09",
    reason: "Impuntualidad reiterada: tercera llegada tarde del mes.",
  },
  {
    position: 13,
    kind: "fine",
    amount: "3.00",
    incident_date: "2026-10-13",
    reason: "Uniforme incompleto por segunda vez en el mes.",
  },
  {
    position: 16,
    kind: "fine",
    amount: "5.00",
    incident_date: "2026-10-20",
    reason: "Uso del celular en clase después del llamado de atención previo.",
  },
  {
    position: 14,
    kind: "fine",
    amount: "2.00",
    incident_date: "2026-10-23",
    reason: "Ausencia sin aviso previo a la sucursal.",
  },
  // Multas ya pagadas.
  {
    position: 10,
    kind: "fine",
    amount: "2.00",
    incident_date: "2026-10-04",
    paid_days_after: 3,
    reason: "Impuntualidad en el horario de inicio de clase.",
  },
  {
    position: 12,
    kind: "fine",
    amount: "3.00",
    incident_date: "2026-10-07",
    paid_days_after: 5,
    reason: "Uso de calzado inadecuado para la práctica.",
  },
  // Registro anulado: no debe contar en los totales.
  {
    position: 17,
    kind: "fine",
    amount: "2.00",
    incident_date: "2026-10-19",
    voided: true,
    reason: "Falta de puntualidad registrada en la clase equivocada.",
  },
];

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
  const match = envFile.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
  if (!match) throw new Error("DATABASE_URL not found in .env.local");
  return match[1].trim();
}

/** Local 14:00 of a YYYY-MM-DD day, as the timestamptz a teacher would record at. */
function timestampFor(dateOnly, hour = 14) {
  return `${dateOnly}T${String(hour).padStart(2, "0")}:00:00-05:00`;
}

function addDays(dateOnly, days) {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
    "SELECT id, name FROM public.branches WHERE name = $1 AND is_active",
    [BRANCH_NAME]
  );
  if (!branch) throw new Error(`Active branch not found: ${BRANCH_NAME}`);

  const [discipline] = await rows(
    "SELECT id FROM public.disciplines WHERE code = $1 AND is_active",
    [DISCIPLINE_CODE]
  );
  if (!discipline) throw new Error(`Active discipline not found: ${DISCIPLINE_CODE}`);

  // Same ordering as the attendance seed: position 0 is the first surname.
  const students = await rows(
    `SELECT s.id, s.first_name, s.surname
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
  if (students.length === 0) throw new Error("No students to attach conduct records to");

  const [admin] = await rows(
    `SELECT ur.user_id
       FROM public.user_roles ur
      WHERE ur.branch_id = $1 AND ur.role = 'admin' AND ur.revoked_at IS NULL
      ORDER BY ur.assigned_at
      LIMIT 1`,
    [branch.id]
  );
  if (!admin) throw new Error("Branch has no active admin to record conduct");

  const existing = await rows(
    `SELECT count(*)::int AS total
       FROM public.student_conduct_records r
       JOIN public.students s ON s.id = r.student_id
      WHERE s.branch_id = $1`,
    [branch.id]
  );
  if (existing[0].total > 0) {
    throw new Error(
      `Branch already has ${existing[0].total} conduct records. Run the previous rollback SQL first.`
    );
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const createdIds = [];
  const planned = [];

  await client.query("BEGIN");
  try {
    for (const record of RECORDS) {
      const student = students[record.position];
      if (!student) throw new Error(`Roster position ${record.position} does not exist`);

      const isFine = record.kind === "fine";
      const isPaid = isFine && record.paid_days_after !== undefined;
      const isVoided = record.voided === true;

      const status = !isFine ? "issued" : isPaid ? "paid" : "pending";
      const paidAt = isPaid
        ? timestampFor(addDays(record.incident_date, record.paid_days_after), 10)
        : null;

      const inserted = await rows(
        `INSERT INTO public.student_conduct_records
           (student_id, kind, reason, incident_date, amount, status,
            paid_at, paid_by, voided_at, voided_by, void_reason,
            created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4::date, $5::numeric, $6,
                 $7, $8, $9, $10, $11,
                 $12, $13, $13)
         RETURNING id`,
        [
          student.id,
          record.kind,
          record.reason,
          record.incident_date,
          isFine ? record.amount : null,
          status,
          paidAt,
          isPaid ? admin.user_id : null,
          isVoided ? timestampFor(addDays(record.incident_date, 1), 9) : null,
          isVoided ? admin.user_id : null,
          isVoided ? "Registrado por error" : null,
          admin.user_id,
          timestampFor(record.incident_date),
        ]
      );

      createdIds.push(inserted[0].id);
      planned.push({
        alumno: `${student.first_name} ${student.surname}`,
        kind: record.kind,
        status,
        amount: isFine ? record.amount : null,
        voided: isVoided,
      });
    }

    if (dryRun) {
      await client.query("ROLLBACK");
      console.log("Dry run:     every insert and DB check passed (rolled back)");
      console.table(planned);
      await client.end();
      return;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  const rollbackPath = join(SCRIPT_DIR, `rollback-kickboxing-conduct-${runId}.sql`);
  writeFileSync(
    rollbackPath,
    `-- Rollback for scripts/seed-kickboxing-conduct.mjs (run id ${runId}).
-- Removes exactly the ${createdIds.length} conduct records that seed created.
BEGIN;

DELETE FROM public.student_conduct_records
 WHERE id = ANY(ARRAY['${createdIds.join("','")}']::uuid[]);

COMMIT;
`,
    "utf8"
  );

  const totals = await rows(
    `SELECT r.kind,
            r.status,
            count(*)::int AS records,
            coalesce(sum(r.amount) FILTER (WHERE r.status = 'pending'), 0)::text AS pending_amount
       FROM public.student_conduct_records r
       JOIN public.students s ON s.id = r.student_id
      WHERE s.branch_id = $1 AND r.voided_at IS NULL
      GROUP BY r.kind, r.status
      ORDER BY r.kind, r.status`,
    [branch.id]
  );

  const perStudent = await rows(
    `SELECT s.surname || ', ' || s.first_name AS alumno,
            count(*) FILTER (WHERE r.kind = 'warning')::int AS llamados,
            count(*) FILTER (WHERE r.kind = 'fine' AND r.status = 'pending')::int AS multas_pendientes,
            coalesce(sum(r.amount) FILTER (WHERE r.kind = 'fine' AND r.status = 'pending'), 0)::text AS deuda,
            count(*) FILTER (WHERE r.status = 'paid')::int AS multas_pagadas
       FROM public.student_conduct_records r
       JOIN public.students s ON s.id = r.student_id
      WHERE s.branch_id = $1 AND r.voided_at IS NULL
      GROUP BY s.id, alumno
      ORDER BY alumno`,
    [branch.id]
  );

  console.log(`Branch:      ${branch.name} (${branch.id})`);
  console.log(`Inserted:    ${createdIds.length} conduct records`);
  console.log("Totals (voided records excluded):");
  console.table(totals);
  console.log("Per student:");
  console.table(perStudent);
  console.log(`Rollback:    ${rollbackPath}`);

  await client.end();
}

main().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exit(1);
});
