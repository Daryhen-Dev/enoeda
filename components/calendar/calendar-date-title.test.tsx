// @vitest-environment jsdom

/**
 * Calendar day and week titles — Spanish typography.
 *
 * `capitalize` uppercases every word, which in Spanish produces "Lunes, 26 De
 * Octubre De 2026": the prepositions get capitalized. The title must uppercase
 * only its first letter, the way the dashboard overview already renders the
 * same date ("Domingo, 25 de octubre").
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// The blocks themselves are covered elsewhere; importing them would drag the
// server-action chain (and `server-only`) into this title test.
vi.mock("./session-block", () => ({
  SessionBlock: () => null,
}));

import { CalendarDayView } from "./calendar-day-view";
import { CalendarWeekView } from "./calendar-week-view";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function render(element: React.ReactElement) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(element);
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root!.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

describe("CalendarDayView title", () => {
  it("uppercases only the first letter of the Spanish date", () => {
    render(<CalendarDayView sessions={[]} baseDate="2026-10-26" />);

    const title = container!.querySelector("#calendar-day-title");
    expect(title?.className).toContain("first-letter:uppercase");
    expect(title?.className).not.toContain("capitalize");
  });

  it("keeps the date the branch timezone formatted", () => {
    render(<CalendarDayView sessions={[]} baseDate="2026-10-26" />);

    expect(container!.querySelector("#calendar-day-title")?.textContent).toBe(
      "lunes, 26 de octubre de 2026"
    );
  });
});

describe("CalendarWeekView title", () => {
  it("uppercases only the first letter of each day label", () => {
    render(<CalendarWeekView sessions={[]} baseDate="2026-10-26" />);

    const labels = [...container!.querySelectorAll("h2, [data-day-label]")].concat(
      [...container!.querySelectorAll("*")].filter((node) =>
        /^[a-záéíóú]+, \d/.test(node.textContent ?? "") && node.children.length === 0
      )
    );

    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.className).not.toContain("capitalize");
    }
  });
});
