// @vitest-environment jsdom

/**
 * SiteHeader breadcrumb — S4 contract.
 *
 * Nested routes must show where the user is: the parent section as a link (with
 * the active branch preserved) before the page title. Top-level routes keep the
 * bare title they had before.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_SHELL_MESSAGES } from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";

const navigation = vi.hoisted(() => ({
  pathname: "/dashboard/payments/validation",
  searchParams: new URLSearchParams(
    "branch=bbbbbbbb-1111-2222-8333-444444444444"
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/components/brand/enoeda-mark", () => ({
  EnoedaMark: () => <span data-testid="enoeda-mark" />,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button type="button" aria-label="Alternar barra lateral" />,
}));

import { SiteHeader } from "./site-header";

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

const BRANCHES = [{ id: BRANCH_ID, name: "Carapungo" }];

describe("SiteHeader breadcrumb", () => {
  it("shows the parent section as a link that keeps the active branch", () => {
    navigation.pathname = "/dashboard/payments/validation";

    rendered = render(
      <SiteHeader displayName="Ana Pérez" branches={BRANCHES} />
    );

    const nav = rendered.container.querySelector(
      `nav[aria-label="${DASHBOARD_SHELL_MESSAGES.BREADCRUMB_LABEL}"]`
    );
    const link = nav?.querySelector("a");

    expect(link?.textContent).toBe(DASHBOARD_SHELL_MESSAGES.PAYMENTS);
    expect(link?.getAttribute("href")).toBe(
      `/dashboard/payments?branch=${BRANCH_ID}`
    );
  });

  it("keeps the page title as the current page heading", () => {
    navigation.pathname = "/dashboard/payments/validation";

    rendered = render(
      <SiteHeader displayName="Ana Pérez" branches={BRANCHES} />
    );

    expect(rendered.container.querySelector("h1")?.textContent).toBe(
      DASHBOARD_SHELL_MESSAGES.PAYMENT_VALIDATION
    );
  });

  it("renders no trail on a top-level route", () => {
    navigation.pathname = "/dashboard/payments";

    rendered = render(
      <SiteHeader displayName="Ana Pérez" branches={BRANCHES} />
    );

    expect(
      rendered.container.querySelector(
        `nav[aria-label="${DASHBOARD_SHELL_MESSAGES.BREADCRUMB_LABEL}"]`
      )
    ).toBeNull();
    expect(rendered.container.querySelector("h1")?.textContent).toBe(
      DASHBOARD_SHELL_MESSAGES.PAYMENTS
    );
  });

  it("links back to the payments console from the settings screen", () => {
    navigation.pathname = "/dashboard/payments/settings";

    rendered = render(
      <SiteHeader displayName="Ana Pérez" branches={BRANCHES} />
    );

    const link = rendered.container.querySelector(
      `nav[aria-label="${DASHBOARD_SHELL_MESSAGES.BREADCRUMB_LABEL}"] a`
    );

    expect(link?.getAttribute("href")).toBe(
      `/dashboard/payments?branch=${BRANCH_ID}`
    );
    expect(rendered.container.querySelector("h1")?.textContent).toBe(
      DASHBOARD_SHELL_MESSAGES.PAYMENT_SETTINGS
    );
  });
});
