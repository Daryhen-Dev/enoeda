// @vitest-environment jsdom

/**
 * StudentHistoryTabs — the tab strip must stay fully reachable on a phone.
 *
 * Five tabs with counters do not fit in 390px. The list used to be a centred
 * `inline-flex` capped at `max-w-full`, so when it overflowed it spilled out of
 * BOTH sides, and the scroll container could only reach the right side: the
 * first tab ("Bitácora (0)") was clipped to "0)" with no way to scroll to it. The
 * list must instead grow to its natural width from the left edge, so the
 * container can scroll the whole strip.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { StudentHistoryTabs } from "./student-history-tabs";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function render() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <StudentHistoryTabs
        defaultTab="notes"
        noteCount={0}
        conductCount={0}
        paymentCount={0}
        progressCount={0}
        enrollmentEventCount={0}
        notesSlot={<p>notas</p>}
        conductSlot={<p>conducta</p>}
        paymentsSlot={<p>pagos</p>}
        progressSlot={<p>progreso</p>}
        enrollmentEvents={[]}
      />
    );
  });
}

function tabList(): HTMLElement {
  return container!.querySelector<HTMLElement>('[data-slot="tabs-list"]')!;
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe("StudentHistoryTabs on a narrow screen", () => {
  it("lets the tab list grow to its natural width instead of capping it", () => {
    render();

    const classes = tabList().classList;
    // A capped list cannot overflow its scroll container cleanly.
    expect(classes.contains("max-w-full")).toBe(false);
    expect(classes.contains("w-max")).toBe(true);
  });

  it("starts the tabs from the left so the first one is never clipped", () => {
    render();

    // Centring an overflowing flex row pushes its start off the left edge,
    // where the scroll container cannot reach it.
    expect(tabList().classList.contains("justify-start")).toBe(true);
  });

  it("keeps the strip inside a horizontal scroll container", () => {
    render();

    expect(tabList().parentElement?.classList.contains("overflow-x-auto")).toBe(
      true
    );
  });

  it("renders all five tabs with their counters", () => {
    render();

    expect(container!.querySelectorAll('[data-slot="tabs-trigger"]')).toHaveLength(
      5
    );
  });
});
