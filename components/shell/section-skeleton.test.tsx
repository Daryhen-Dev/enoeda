// @vitest-environment jsdom

/**
 * SectionSkeleton — S1 contract: a section route must render an accessible
 * loading placeholder shaped like its destination while the server answers.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SECTION_FEEDBACK_MESSAGES } from "@/lib/localization/es-ec";

import {
  SECTION_SKELETON_VARIANT,
  SectionSkeleton,
} from "./section-skeleton";

interface Rendered {
  container: HTMLDivElement;
  unmount(): void;
}

let rendered: Rendered;

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

beforeEach(() => {
  rendered = render(
    <SectionSkeleton variant={SECTION_SKELETON_VARIANT.TABLE} label="Estudiantes" />
  );
});

afterEach(() => {
  rendered.unmount();
});

describe("SectionSkeleton", () => {
  it("announces that the section is loading", () => {
    const main = rendered.container.querySelector("main");
    expect(main?.getAttribute("aria-busy")).toBe("true");
    expect(
      rendered.container.querySelector("[role='status']")?.textContent
    ).toContain(SECTION_FEEDBACK_MESSAGES.LOADING_SECTION);
  });

  it("names the destination section for assistive technology", () => {
    expect(
      rendered.container.querySelector("main")?.getAttribute("aria-label")
    ).toContain("Estudiantes");
  });

  it("renders placeholder rows instead of the real content", () => {
    const placeholders = rendered.container.querySelectorAll(
      "[data-slot='skeleton']"
    );
    // Header blocks (title + description) plus at least one row per column.
    expect(placeholders.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps the placeholder boxes decorative for the accessibility tree", () => {
    const decorativeWrapper = rendered.container.querySelector(
      "[aria-hidden='true']"
    );

    expect(decorativeWrapper).not.toBeNull();
    expect(
      decorativeWrapper!.querySelectorAll("[data-slot='skeleton']").length
    ).toBeGreaterThan(0);
  });

  it("accepts every section variant without losing the loading state", () => {
    rendered.unmount();

    for (const variant of Object.values(SECTION_SKELETON_VARIANT)) {
      rendered = render(<SectionSkeleton variant={variant} label="Sección" />);
      expect(rendered.container.querySelector("main")?.getAttribute("aria-busy")).toBe(
        "true"
      );
      rendered.unmount();
    }

    rendered = render(<SectionSkeleton variant="table" label="Sección" />);
  });
});
