/**
 * Palette entries — the palette is one list of two kinds of things: records
 * (students) and destinations (sections). The ranking and the hrefs are pure so
 * the dialog stays a dumb renderer.
 */

import { describe, expect, it } from "vitest";

import { navigationItems } from "@/components/app-sidebar";
import { DASHBOARD_SHELL_MESSAGES } from "@/lib/localization/es-ec";

import {
  buildSectionEntries,
  buildStudentEntries,
  filterSectionEntries,
  normalizePaletteText,
  type PaletteStudentRow,
} from "./palette-entries";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";

describe("normalizePaletteText", () => {
  it("ignores case and accents so 'cédula' and 'cedula' match the same rows", () => {
    expect(normalizePaletteText("Pérez  Cédula")).toBe("perez cedula");
    expect(normalizePaletteText("OÑA")).toBe("ona");
  });
});

describe("buildSectionEntries", () => {
  it("maps every visible sidebar section, keeping the active branch", () => {
    const entries = buildSectionEntries(navigationItems, BRANCH_ID, {
      isAdmin: true,
      canManageProfile: true,
    });

    const payments = entries.find(
      (entry) => entry.label === DASHBOARD_SHELL_MESSAGES.PAYMENTS
    );

    expect(payments?.href).toBe(`/dashboard/payments?branch=${BRANCH_ID}`);
    expect(entries.length).toBe(navigationItems.length);
  });

  it("drops admin-only sections for a teacher-only caller", () => {
    const entries = buildSectionEntries(navigationItems, BRANCH_ID, {
      isAdmin: false,
      canManageProfile: true,
      isTeacherOnly: true,
    });

    expect(entries.map((entry) => entry.label)).not.toContain(
      DASHBOARD_SHELL_MESSAGES.PAYMENTS
    );
    expect(entries.map((entry) => entry.label)).toContain(
      DASHBOARD_SHELL_MESSAGES.CONDUCT
    );
  });

  it("keeps a non-branch-scoped section free of the branch query", () => {
    const entries = buildSectionEntries(navigationItems, BRANCH_ID, {
      canManageProfile: true,
    });

    const profile = entries.find(
      (entry) => entry.label === DASHBOARD_SHELL_MESSAGES.PROFILE
    );

    expect(profile?.href).toBe("/dashboard/profile");
  });
});

describe("filterSectionEntries", () => {
  const entries = buildSectionEntries(navigationItems, BRANCH_ID, {
    isAdmin: true,
    canManageProfile: true,
  });

  it("lists every section while the query is empty", () => {
    expect(filterSectionEntries(entries, "")).toHaveLength(entries.length);
  });

  it("matches a section by a prefix of its label, ignoring accents and case", () => {
    expect(
      filterSectionEntries(entries, "CINTU").map((entry) => entry.label)
    ).toEqual([DASHBOARD_SHELL_MESSAGES.BELTS]);
  });

  it("matches in the middle of the label too", () => {
    expect(
      filterSectionEntries(entries, "orari").map((entry) => entry.label)
    ).toEqual([DASHBOARD_SHELL_MESSAGES.CLASS_SCHEDULES]);
  });

  it("returns nothing when the query matches no section", () => {
    expect(filterSectionEntries(entries, "zzz")).toEqual([]);
  });
});

describe("buildStudentEntries", () => {
  it("builds a row per student with its meta line, badge and branch-scoped href", () => {
    const rows: PaletteStudentRow[] = [
      {
        student: {
          id: "s1",
          branch_id: BRANCH_ID,
          first_name: "Ana",
          surname: "Pérez",
          national_id: "1712345678",
          email: null,
          date_of_birth: null,
          activation_status: "active",
          active_discipline_names: ["Karate"],
          active_disciplines: [],
        },
        isActive: true,
      },
    ];

    const entries = buildStudentEntries(rows, BRANCH_ID);

    expect(entries[0].label).toBe("Ana Pérez");
    expect(entries[0].meta).toContain("Karate");
    expect(entries[0].meta).toContain("1712345678");
    expect(entries[0].href).toBe(
      `/dashboard/students/s1?branch=${BRANCH_ID}`
    );
  });

  it("falls back to the branch the student belongs to when the URL has none", () => {
    const rows: PaletteStudentRow[] = [
      {
        student: {
          id: "s1",
          branch_id: BRANCH_ID,
          first_name: "Ana",
          surname: "Pérez",
          national_id: null,
          email: null,
          date_of_birth: null,
          activation_status: "active",
          active_discipline_names: [],
          active_disciplines: [],
        },
        isActive: false,
      },
    ];

    expect(buildStudentEntries(rows, null)[0].href).toBe(
      `/dashboard/students/s1?branch=${BRANCH_ID}`
    );
  });
});
