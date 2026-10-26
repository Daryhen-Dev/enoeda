// @vitest-environment jsdom

/**
 * MobileBottomNav — the teacher's daily loop on a phone.
 *
 * A teacher at the mat had to open the sidebar sheet to reach the four screens
 * they use every class. This bar keeps them one thumb-tap away, marks the
 * current one, and keeps the active branch in every link.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_SHELL_MESSAGES } from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";

const navigation = vi.hoisted(() => ({
  pathname: "/dashboard",
  searchParams: new URLSearchParams("branch=bbbbbbbb-1111-2222-8333-444444444444"),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));

import {
  MOBILE_PRIMARY_URLS,
  MobileBottomNav,
  getMobilePrimaryItems,
} from "./mobile-bottom-nav";
import { navigationItems } from "@/components/app-sidebar";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function render() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(<MobileBottomNav />);
  });
}

function links(): HTMLAnchorElement[] {
  return [...(container?.querySelectorAll("nav a") ?? [])] as HTMLAnchorElement[];
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  navigation.pathname = "/dashboard";
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

describe("MobileBottomNav", () => {
  it("offers the teacher's four daily screens in order", () => {
    render();

    expect(links().map((link) => link.textContent?.trim())).toEqual([
      DASHBOARD_SHELL_MESSAGES.OVERVIEW,
      DASHBOARD_SHELL_MESSAGES.CALENDAR,
      DASHBOARD_SHELL_MESSAGES.CONDUCT,
      DASHBOARD_SHELL_MESSAGES.STUDENTS,
    ]);
  });

  it("only exists below md, where the sidebar is a sheet", () => {
    render();

    const nav = container!.querySelector("nav");
    expect(nav?.className).toContain("md:hidden");
  });

  it("keeps the active branch in every link", () => {
    render();

    for (const link of links()) {
      expect(link.getAttribute("href")).toContain(`branch=${BRANCH_ID}`);
    }
  });

  it("marks the current screen for assistive technology", () => {
    navigation.pathname = "/dashboard/conduct";
    render();

    const current = links().filter(
      (link) => link.getAttribute("aria-current") === "page"
    );
    expect(current).toHaveLength(1);
    expect(current[0].textContent?.trim()).toBe(
      DASHBOARD_SHELL_MESSAGES.CONDUCT
    );
  });

  it("does not claim the overview for a nested route of another section", () => {
    navigation.pathname = "/dashboard/students/abc-123";
    render();

    const current = links().filter(
      (link) => link.getAttribute("aria-current") === "page"
    );
    expect(current).toHaveLength(1);
    expect(current[0].textContent?.trim()).toBe(
      DASHBOARD_SHELL_MESSAGES.STUDENTS
    );
  });

  it("is announced as the main navigation", () => {
    render();

    const nav = container!.querySelector("nav");
    expect(nav?.getAttribute("aria-label")).toBe(
      DASHBOARD_SHELL_MESSAGES.MOBILE_NAV_LABEL
    );
  });
});

describe("getMobilePrimaryItems", () => {
  it("takes the four curated routes from the sidebar list", () => {
    const items = getMobilePrimaryItems(navigationItems, {
      canManageProfile: true,
    });

    expect(items.map((item) => item.url)).toEqual([...MOBILE_PRIMARY_URLS]);
    expect(items).toHaveLength(MOBILE_PRIMARY_URLS.length);
  });

  it("never promotes an admin-only or profile-only entry", () => {
    const items = getMobilePrimaryItems(navigationItems, {
      canManageProfile: true,
    });

    for (const item of items) {
      expect(item.adminOnly).toBeUndefined();
      expect(item.profileOnly).toBeUndefined();
    }
  });

  it("shows the same four to a teacher and to an admin", () => {
    const forTeacher = getMobilePrimaryItems(navigationItems, {
      isTeacherOnly: true,
      canManageProfile: true,
    });
    const forAdmin = getMobilePrimaryItems(navigationItems, {
      isAdmin: true,
      canManageProfile: true,
    });

    expect(forTeacher.map((item) => item.url)).toEqual(
      forAdmin.map((item) => item.url)
    );
  });
});
