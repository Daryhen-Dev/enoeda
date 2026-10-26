/**
 * Loading and not-found boundaries — S1 contract.
 *
 * Next.js falls back to a frozen screen while a server component resolves and
 * to the framework error overlay when one throws, unless the segment ships its
 * own `loading.tsx` / `error.tsx` / `not-found.tsx`. This test pins which
 * dashboard segments must carry those files so a new section cannot silently
 * ship without them.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = path.resolve(import.meta.dirname, "..", "..", "app", "dashboard");

/** Every section route the dashboard shell exposes in its sidebar. */
const SECTION_ROUTES = [
  "students",
  "students/[id]",
  "calendar",
  "conduct",
  "schedule",
  "staff",
  "belts",
  "payments",
  "payments/validation",
  "payments/settings",
  "branches",
  "profile",
] as const;

describe("dashboard loading boundaries", () => {
  it.each(SECTION_ROUTES)("section %s ships its own loading boundary", (route) => {
    const loadingFile = path.join(APP_ROOT, route, "loading.tsx");

    expect(existsSync(loadingFile)).toBe(true);
    expect(readFileSync(loadingFile, "utf8").trim().length).toBeGreaterThan(0);
  });

  it("keeps the tailored overview loading boundary", () => {
    expect(existsSync(path.join(APP_ROOT, "loading.tsx"))).toBe(true);
  });
});

describe("dashboard error and not-found boundaries", () => {
  it("catches section failures with one dashboard error boundary", () => {
    expect(existsSync(path.join(APP_ROOT, "error.tsx"))).toBe(true);
  });

  it("renders a dashboard not-found screen for a missing student", () => {
    expect(existsSync(path.join(APP_ROOT, "not-found.tsx"))).toBe(true);
  });
});
