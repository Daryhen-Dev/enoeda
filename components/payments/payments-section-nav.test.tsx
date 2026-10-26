// @vitest-environment jsdom

/**
 * PaymentsSectionNav — S5 contract.
 *
 * The payments section exposes one visible sub-navigation from each of its
 * three screens (Resumen, Validar, Precios), keeps the active branch in every
 * tab link and marks the current tab as the active one.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PAYMENT_SECTION_NAV_MESSAGES } from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";

const navigation = vi.hoisted(() => ({
  pathname: "/dashboard/payments",
  searchParams: new URLSearchParams(
    "branch=bbbbbbbb-1111-2222-8333-444444444444"
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));

import { PaymentsSectionNav } from "./payments-section-nav";

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

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  rendered?.unmount();
  rendered = null;
});

function renderNav(pathname: string) {
  navigation.pathname = pathname;
  rendered = render(<PaymentsSectionNav branchId={BRANCH_ID} />);
  return rendered.container;
}

function links(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLAnchorElement>(
      `nav[aria-label="${PAYMENT_SECTION_NAV_MESSAGES.LABEL}"] a`
    )
  );
}

describe("PaymentsSectionNav", () => {
  it("renders the three payments tabs and keeps the active branch in each link", () => {
    const container = renderNav("/dashboard/payments");

    const tabLinks = links(container);

    expect(tabLinks.map((link) => link.textContent)).toEqual([
      PAYMENT_SECTION_NAV_MESSAGES.SUMMARY,
      PAYMENT_SECTION_NAV_MESSAGES.VALIDATION,
      PAYMENT_SECTION_NAV_MESSAGES.SETTINGS,
    ]);
    expect(tabLinks.map((link) => link.getAttribute("href"))).toEqual([
      `/dashboard/payments?branch=${BRANCH_ID}`,
      `/dashboard/payments/validation?branch=${BRANCH_ID}`,
      `/dashboard/payments/settings?branch=${BRANCH_ID}`,
    ]);
  });

  it("marks only the summary tab as current on the summary screen", () => {
    const container = renderNav("/dashboard/payments");

    const current = links(container).filter(
      (link) => link.getAttribute("aria-current") === "page"
    );

    expect(current.map((link) => link.textContent)).toEqual([
      PAYMENT_SECTION_NAV_MESSAGES.SUMMARY,
    ]);
  });

  it("marks only the validation tab as current on the validation screen", () => {
    const container = renderNav("/dashboard/payments/validation");

    const current = links(container).filter(
      (link) => link.getAttribute("aria-current") === "page"
    );

    expect(current.map((link) => link.textContent)).toEqual([
      PAYMENT_SECTION_NAV_MESSAGES.VALIDATION,
    ]);
  });

  it("marks only the settings tab as current on the settings screen", () => {
    const container = renderNav("/dashboard/payments/settings");

    const current = links(container).filter(
      (link) => link.getAttribute("aria-current") === "page"
    );

    expect(current.map((link) => link.textContent)).toEqual([
      PAYMENT_SECTION_NAV_MESSAGES.SETTINGS,
    ]);
  });
});
