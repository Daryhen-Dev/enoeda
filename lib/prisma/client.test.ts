/**
 * Import-policy guard: runtime Prisma deps are only used by the private executor
 * and the RLS client module.
 * Type-only imports from generated Prisma types are always permitted.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const ALLOWED = new Set(
  ["lib/auth/server-context.ts", "lib/prisma/client.ts"].map((f) =>
    path.join(ROOT, f)
  )
);
const SKIP =
  /(?:node_modules|\.next|dist|\.git|\.turbo|\.agents|\.kiro|\.atl|__mocks__|generated|\.test\.[jt]sx?$|\.spec\.[jt]sx?$)/;
const RUNTIME_PRISMA =
  /(?:(?<!\btype\s)(?:import|export)\s+(?!type\b)[^;]*from\s+['"](?:@prisma\/(?:client|adapter-pg)|@\/lib\/prisma(?:\/(?!generated\/client\/index\.d))?[^'"]*|\.\.?\/[^'"]*prisma(?:\/(?!generated\/client\/index\.d))?[^'"]*)['"]|(?:require|import)\s*\(\s*['"](?:@prisma\/(?:client|adapter-pg)|@\/lib\/prisma|\.\.?\/[^'"]*prisma)[^'"]*['"])/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (SKIP.test(f)) continue;
    if (e.isDirectory()) out.push(...walk(f));
    else if (/\.[jt]sx?$/.test(e.name)) out.push(f);
  }
  return out;
}

describe("Prisma import policy", () => {
  it("runtime Prisma dependencies are only imported by allowed modules", () => {
    const violations: string[] = [];
    for (const file of walk(ROOT)) {
      if (ALLOWED.has(file)) continue;
      const source = readFileSync(file, "utf-8");
      if (/\b(?:require|import)\s*\(\s*[^'"]/.test(source))
        violations.push(
          `${path.relative(ROOT, file)}: nonliteral runtime loader`
        );
      for (const line of source.split("\n")) {
        if (RUNTIME_PRISMA.test(line) && !/^\s*(?:\/\/|\*)/.test(line))
          violations.push(`${path.relative(ROOT, file)}: ${line.trim()}`);
      }
    }
    expect(
      violations,
      "Unexpected Prisma runtime imports outside allowed modules"
    ).toEqual([]);
  });

  it("keeps client.ts server-only", () => {
    const source = readFileSync(
      path.join(ROOT, "lib/prisma/client.ts"),
      "utf-8"
    );
    expect(source).toContain('import "server-only"');
  });
});
