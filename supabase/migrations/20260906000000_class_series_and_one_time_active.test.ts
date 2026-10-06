import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260906000000_class_series_and_one_time_active.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("Class series and one-time active migration — structural validation", () => {
  it("adds a nullable series_id column plus index to scheduled_classes", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.scheduled_classes\s+ADD COLUMN series_id uuid/
    );
    expect(sql).toMatch(
      /CREATE INDEX scheduled_classes_series_id_idx\s+ON public\.scheduled_classes \(series_id\)/
    );
  });

  it("backfills series_id for every legacy row using the lowest id (uuid ordering) of each (branch_id, discipline_id, start_time) group", () => {
    expect(sql).toMatch(
      /WITH legacy_series AS \([\s\S]*?\(array_agg\(id ORDER BY id\)\)\[1\] AS series_id[\s\S]*?GROUP BY branch_id, discipline_id, start_time/
    );
    expect(sql).toMatch(
      /UPDATE public\.scheduled_classes[\s\S]*?SET series_id = ls\.series_id[\s\S]*?FROM legacy_series/
    );
  });

  it("adds a NOT NULL is_active flag defaulting to true on one_time_classes", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.one_time_classes\s+ADD COLUMN is_active boolean NOT NULL DEFAULT true/
    );
  });

  it("is transactional and contains no destructive statements", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});
