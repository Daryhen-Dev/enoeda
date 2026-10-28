#!/usr/bin/env node
/**
 * One-off demo seed of current belts for the Carapungo Kickboxing group.
 *
 * Inserts `student_progress` rows (the directory and the attendance sheet read
 * the latest one per student+discipline) so every student shows a belt swatch.
 * Three students get a promotion history so the "latest row wins" path is
 * exercised with more than one row per student.
 *
 *   node scripts/seed-kickboxing-belts.mjs
 *   node scripts/seed-kickboxing-belts.mjs --dry-run   # validates, rolls back
 *
 * Aborts when a student already carries more than one progress row (a previous
 * run), so run the generated rollback first. The rollback SQL with the exact
 * ids is written as scripts/rollback-kickboxing-belts-<run id>.sql.
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
 * Keyed by the student's roster position (surname order, same as the
 * attendance seed). Each entry is the promotion path, oldest first; the last
 * one is the belt the directory shows. Positions 1 and 17 already had a
 * `Blanco` row from before this seed, so their path starts at the next belt.
 */
const PROMOTIONS = new Map([
  [0, [["Blanco", "2026-10-01"], ["Puntas amarillas", "2026-10-08"], ["Amarillo", "2026-10-15"], ["Azul", "2026-10-22"]]],
  [1, [["Puntas amarillas", "2026-10-23"]]],
  [2, [["Verde", "2026-10-20"]]],
  [3, [["Verde", "2026-10-20"]]],
  [4, [["Blanco", "2026-10-05"], ["Amarillo", "2026-10-24"]]],
  [5, [["Amarillo", "2026-10-20"]]],
  [6, [["Amarillo", "2026-10-20"]]],
  [7, [["Puntas amarillas", "2026-10-20"]]],
  [8, [["Puntas amarillas", "2026-10-20"]]],
  [9, [["Blanco", "2026-10-06"], ["Amarillo", "2026-10-24"]]],
  [10, [["Blanco", "2026-10-20"]]],
  [11, [["Blanco", "2026-10-20"]]],
  [12, [["Blanco", "2026-10-20"]]],
  [13, [["Puntas amarillas", "2026-10-20"]]],
  [14, [["Blanco", "2026-10-20"]]],
  [15, [["Blanco", "2026-10-20"]]],
  [16, [["Blanco", "2026-10-20"]]],
  [17, [["Puntas amarillas", "2026-10-24"]]],
  [18, [["Blanco", "2026-10-20"]]],
]);

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
  const match = envFile.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
  if (!match) throw new Error("DATABASE_URL not found in .env.local");
  return match[1].trim();
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
  if (students.length === 0) throw new Error("No students to seed belts for");

  const levels = new Map(
    (
      await rows(
        "SELECT id, name FROM public.discipline_levels WHERE discipline_id = $1",
        [discipline.id]
      )
    ).map((level) => [level.name, level.id])
  );
  for (const [, promotions] of PROMOTIONS) {
    for (const [levelName] of promotions) {
      if (!levels.has(levelName)) {
        throw new Error(`Level "${levelName}" does not exist for ${DISCIPLINE_CODE}`);
      }
    }
  }

  const [admin] = await rows(
    `SELECT ur.user_id
       FROM public.user_roles ur
      WHERE ur.branch_id = $1 AND ur.role = 'admin' AND ur.revoked_at IS NULL
      ORDER BY ur.assigned_at
      LIMIT 1`,
    [branch.id]
  );
  if (!admin) throw new Error("Branch has no active admin to record promotions");

  const replayed = await rows(
    `SELECT s.surname || ', ' || s.first_name AS alumno, count(*)::int AS rows
       FROM public.student_progress sp
       JOIN public.students s ON s.id = sp.student_id
      WHERE s.branch_id = $1 AND sp.discipline_id = $2
      GROUP BY s.id, alumno
      HAVING count(*) > 1
      ORDER BY alumno`,
    [branch.id, discipline.id]
  );
  if (replayed.length > 0) {
    throw new Error(
      `Some students already carry more than one belt row (${replayed
        .map((row) => row.alumno)
        .join("; ")}). Run the previous rollback SQL first.`
    );
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const createdIds = [];
  const planned = [];

  await client.query("BEGIN");
  try {
    for (const [position, student] of students.entries()) {
      const promotions = PROMOTIONS.get(position);
      if (!promotions) continue;

      for (const [levelName, promotedAt] of promotions) {
        const inserted = await rows(
          `INSERT INTO public.student_progress
             (student_id, discipline_id, level_id, promoted_at, observations, created_by)
           VALUES ($1, $2, $3, $4::date, NULL, $5)
           RETURNING id`,
          [student.id, discipline.id, levels.get(levelName), promotedAt, admin.user_id]
        );
        createdIds.push(inserted[0].id);
      }

      planned.push({
        alumno: `${student.first_name} ${student.surname}`,
        cinturon: promotions.at(-1)[0],
        historial: promotions.length > 1 ? promotions.length : 1,
      });
    }

    if (dryRun) {
      await client.query("ROLLBACK");
      console.log("Dry run:     every insert passed the DB checks (rolled back)");
      console.table(planned);
      await client.end();
      return;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  const rollbackPath = join(SCRIPT_DIR, `rollback-kickboxing-belts-${runId}.sql`);
  writeFileSync(
    rollbackPath,
    `-- Rollback for scripts/seed-kickboxing-belts.mjs (run id ${runId}).
-- Removes exactly the ${createdIds.length} student_progress rows that seed created.
BEGIN;

DELETE FROM public.student_progress
 WHERE id = ANY(ARRAY['${createdIds.join("','")}']::uuid[]);

COMMIT;
`,
    "utf8"
  );

  // What the directory will show: latest row per student.
  const current = await rows(
    `SELECT dl.name AS cinturon, dl.color, count(*)::int AS alumnos
       FROM (
         SELECT DISTINCT ON (sp.student_id) sp.student_id, sp.level_id
           FROM public.student_progress sp
           JOIN public.students s ON s.id = sp.student_id
          WHERE s.branch_id = $1 AND sp.discipline_id = $2
          ORDER BY sp.student_id, sp.promoted_at DESC, sp.created_at DESC
       ) latest
       JOIN public.discipline_levels dl ON dl.id = latest.level_id
      GROUP BY dl.name, dl.color, dl.sort_order
      ORDER BY dl.sort_order`,
    [branch.id, discipline.id]
  );

  console.log(`Branch:      ${branch.name}`);
  console.log(`Inserted:    ${createdIds.length} student_progress rows`);
  console.log("Current belts (what the directory swatch shows):");
  console.table(current);
  console.log(`Rollback:    ${rollbackPath}`);

  await client.end();
}

main().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exit(1);
});
