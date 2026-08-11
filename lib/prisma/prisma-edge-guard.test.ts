/**
 * Static guard: Prisma's Node-only client must be isolated from Edge code.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const PRISMA_CLIENT_PATH = path.join(ROOT, "lib", "prisma", "client.ts");
const MIDDLEWARE_PATH = path.join(ROOT, "middleware.ts");

const PRISMA_IMPORT_PATTERNS = [
  /from\s+['"]@\/lib\/prisma/,
  /from\s+['"]\.\.?\/.*lib\/prisma/,
  /from\s+['"]@prisma\/client/,
  /from\s+['"]@prisma\/adapter-pg/,
  /require\s*\(\s*['"]@\/lib\/prisma/,
  /require\s*\(\s*['"]@prisma\/client/,
  /import\s*\(\s*['"]@\/lib\/prisma/,
];

describe("Prisma Edge Guard", () => {
  it("marks the Prisma client module as server-only", () => {
    expect(existsSync(PRISMA_CLIENT_PATH), "client.ts should exist").toBe(true);

    const clientSource = readFileSync(PRISMA_CLIENT_PATH, "utf-8");

    expect(clientSource).toMatch(/^import\s+["']server-only["'];/m);
  });

  it("middleware.ts does not import Prisma", () => {
    expect(existsSync(MIDDLEWARE_PATH), "middleware.ts should exist").toBe(true);

    const middlewareSource = readFileSync(MIDDLEWARE_PATH, "utf-8");

    for (const pattern of PRISMA_IMPORT_PATTERNS) {
      expect(middlewareSource).not.toMatch(pattern);
    }
  });
});
