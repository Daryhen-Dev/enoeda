/**
 * formatTransactionFailure — the one line that reaches the logs when an RLS
 * transaction fails. It must carry the real database cause, because the dev
 * log sink printed the previous structured object as "{}".
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { formatTransactionFailure } from "./client";

describe("formatTransactionFailure", () => {
  it("keeps the error name and message", () => {
    expect(formatTransactionFailure(new Error("boom"))).toBe("Error: boom");
  });

  it("adds the driver code when present", () => {
    const error = Object.assign(new Error("unique violation"), { code: "P2002" });

    expect(formatTransactionFailure(error)).toContain("code=P2002");
  });

  it("surfaces the database cause the driver adapter nests", () => {
    const error = new Error("Transaction failed", {
      cause: new Error('new row violates row-level security policy for table "payments"'),
    });

    expect(formatTransactionFailure(error)).toContain(
      'cause=new row violates row-level security policy for table "payments"'
    );
  });

  it("serializes a non-error cause instead of dropping it", () => {
    const error = new Error("Transaction failed", {
      cause: { kind: "postgres", constraint: "payments_coverage_no_overlap" },
    });

    expect(formatTransactionFailure(error)).toContain(
      "payments_coverage_no_overlap"
    );
  });

  it("never leaks a password from a connection string", () => {
    const error = new Error(
      "connect failed postgresql://postgres.user:s3cret@db.example.com:6543/postgres"
    );

    const line = formatTransactionFailure(error);
    expect(line).not.toContain("s3cret");
    expect(line).toContain("postgres.user:****@");
  });

  it("handles a thrown non-error value", () => {
    expect(formatTransactionFailure("plain failure")).toBe("plain failure");
  });
});
