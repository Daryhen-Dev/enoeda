// @vitest-environment node

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * A `"use client"` module turns every export into a client reference, so a
 * server component cannot call a helper that lives there — Next.js throws
 * "Attempted to call X() from the server but X is on the client" at runtime and
 * neither the typecheck nor the component tests catch it. This pins the
 * `?tab=` resolver to a server-safe module and the detail page to that import.
 */

const PAGE_PATH = "app/dashboard/students/[id]/page.tsx";
const RESOLVER_MODULE = "@/lib/domain/students/history-tabs";
const CLIENT_COMPONENT_MODULE = "@/components/students/student-history-tabs";

/** Import specifiers of every statement that mentions the given symbol. */
function importSpecifiersFor(source: string, symbol: string): string[] {
  const statements = source.match(/import[\s\S]*?from\s*"[^"]+"/g) ?? [];
  return statements
    .filter((statement) => new RegExp(`\\b${symbol}\\b`).test(statement))
    .map((statement) => statement.match(/from\s*"([^"]+)"/)![1]);
}

describe("history tab resolver boundary", () => {
  it("imports the resolver and its tab type from a server-safe module", () => {
    const page = readFileSync(PAGE_PATH, "utf8");

    expect(importSpecifiersFor(page, "resolveStudentHistoryTab")).toEqual([
      RESOLVER_MODULE,
    ]);
    expect(importSpecifiersFor(page, "StudentHistoryTab")).toEqual([
      RESOLVER_MODULE,
    ]);
  });

  it("keeps the resolver out of the client component", () => {
    const page = readFileSync(PAGE_PATH, "utf8");
    expect(page).not.toContain(
      `} from "${CLIENT_COMPONENT_MODULE}"\n\n`
    );
    expect(importSpecifiersFor(page, "StudentHistoryTabs")).toEqual([
      CLIENT_COMPONENT_MODULE,
    ]);
  });

  it("ships the resolver in a module without the client directive", () => {
    const source = readFileSync("lib/domain/students/history-tabs.ts", "utf8");

    expect(source.trimStart().startsWith('"use client"')).toBe(false);
    expect(source).toContain("export function resolveStudentHistoryTab");
  });
});
