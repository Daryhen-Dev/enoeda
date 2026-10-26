// @vitest-environment jsdom

/**
 * StudentSearchTrigger — S1 contract (header half).
 *
 * The header control must not own palette state: it announces itself in Spanish
 * and dispatches the open event the palette listens for.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OPEN_STUDENT_SEARCH_EVENT } from "@/components/shell/student-search-event";
import { STUDENT_SEARCH_MESSAGES } from "@/lib/localization/es-ec";

import { StudentSearchTrigger } from "./student-search-trigger";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(<StudentSearchTrigger />);
  });
});

afterEach(() => {
  act(() => root!.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

describe("StudentSearchTrigger", () => {
  it("is announced as the student search in Spanish", () => {
    const button = container!.querySelector("button");

    expect(button?.getAttribute("aria-label")).toBe(
      STUDENT_SEARCH_MESSAGES.TRIGGER_LABEL
    );
  });

  it("shows a visible label on a phone, not just a magnifier", () => {
    const visibleLabels = [
      ...container!.querySelectorAll("span, kbd"),
    ].filter(
      (node) =>
        (node.textContent ?? "").includes("Buscar") &&
        // `lg:hidden` is a different token: only a bare `hidden` hides always.
        !node.classList.contains("hidden")
    );

    expect(visibleLabels.length).toBeGreaterThan(0);
  });

  it("asks the palette to open when clicked", () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_STUDENT_SEARCH_EVENT, listener);

    act(() => {
      container!.querySelector("button")!.click();
    });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_STUDENT_SEARCH_EVENT, listener);
  });
});
