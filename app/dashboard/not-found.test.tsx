// @vitest-environment jsdom

/**
 * DashboardNotFound — S1 contract: a missing record inside the dashboard shows
 * a Spanish screen that leads back to where the user came from, not the
 * framework's default 404.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SECTION_FEEDBACK_MESSAGES } from "@/lib/localization/es-ec";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import DashboardNotFound from "./not-found";

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

describe("DashboardNotFound", () => {
  it("states the record could not be found in Spanish", () => {
    rendered = render(<DashboardNotFound />);
    const text = rendered.container.textContent ?? "";

    expect(text).toContain(SECTION_FEEDBACK_MESSAGES.NOT_FOUND_TITLE);
    expect(text).toContain(SECTION_FEEDBACK_MESSAGES.NOT_FOUND_DESCRIPTION);
  });

  it("offers a way back to the students directory", () => {
    rendered = render(<DashboardNotFound />);
    const link = rendered.container.querySelector("a");

    expect(link?.getAttribute("href")).toBe("/dashboard/students");
    expect(link?.textContent).toContain(
      SECTION_FEEDBACK_MESSAGES.NOT_FOUND_ACTION
    );
  });
});
