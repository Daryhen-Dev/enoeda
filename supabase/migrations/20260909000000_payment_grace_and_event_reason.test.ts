import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  __dirname,
  "20260909000000_payment_grace_and_event_reason.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("Payment grace and event reason migration — structural validation", () => {
  it("adds branches.payment_grace_days with a bounded non-negative check", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.branches\s+ADD COLUMN payment_grace_days smallint NOT NULL DEFAULT 0,\s+ADD CONSTRAINT branches_payment_grace_days_ck CHECK \(payment_grace_days BETWEEN 0 AND 60\)/
    );
  });

  it("adds discipline_events.reason as nullable text with a closed value check", () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.discipline_events\s+ADD COLUMN reason text,\s+ADD CONSTRAINT discipline_events_reason_ck CHECK \(reason IS NULL OR reason IN \('non_payment', 'manual'\)\)/
    );
  });

  it("documents the new discipline_events.reason column", () => {
    expect(sql).toMatch(
      /COMMENT ON COLUMN public\.discipline_events\.reason IS/
    );
  });

  it("is transactional and contains no destructive statements", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
    expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX|POLICY|FUNCTION)\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});
