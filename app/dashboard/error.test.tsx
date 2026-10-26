// @vitest-environment jsdom

/**
 * DashboardError — S1 contract: a failing section must show a recoverable
 * Spanish error surface whose "Reintentar" action asks Next.js to retry.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SECTION_FEEDBACK_MESSAGES } from "@/lib/localization/es-ec";

import DashboardError from "./error";

interface Rendered {
  container: HTMLDivElement;
  unmount(): void;
}

function render(element: React.ReactElement): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

let rendered: Rendered | null = null;

afterEach(() => {
  rendered?.unmount();
  rendered = null;
});

describe("DashboardError", () => {
  it("explains the failure in Spanish instead of showing the raw error", () => {
    rendered = render(
      <DashboardError error={new Error("boom")} reset={vi.fn()} />
    );
    const text = rendered.container.textContent ?? "";

    expect(text).toContain(SECTION_FEEDBACK_MESSAGES.ERROR_TITLE);
    expect(text).toContain(SECTION_FEEDBACK_MESSAGES.ERROR_DESCRIPTION);
    expect(text).not.toContain("boom");
  });

  it("retries the failed section when the user asks to", () => {
    const reset = vi.fn();
    rendered = render(<DashboardError error={new Error("boom")} reset={reset} />);

    const retry = [...rendered.container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes(SECTION_FEEDBACK_MESSAGES.ERROR_RETRY)
    );
    expect(retry).toBeDefined();

    act(() => {
      retry!.click();
    });

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("is announced as an alert", () => {
    rendered = render(
      <DashboardError error={new Error("boom")} reset={vi.fn()} />
    );
    expect(
      rendered.container.querySelector("[role='alert']")
    ).not.toBeNull();
  });
});
