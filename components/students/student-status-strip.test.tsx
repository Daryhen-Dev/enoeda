/**
 * StudentStatusStrip — the four questions an admin or teacher answers before
 * reading a student's whole file: can they train, do they owe money, do they
 * show up, and where are they in the belt path.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  STUDENT_STATUS_STRIP_MESSAGES,
  formatCurrency,
} from "@/lib/localization/es-ec";

import { StudentStatusStrip } from "./student-status-strip";

const KARATE = "d1111111-1111-4111-8111-111111111111";
const KICKBOXING = "d2222222-2222-4222-8222-222222222222";

function render(props: Partial<Parameters<typeof StudentStatusStrip>[0]>) {
  return renderToStaticMarkup(
    <StudentStatusStrip
      enrollments={[
        { discipline_id: KARATE, discipline_name: "Karate", is_active: true, suspended_at: null },
        { discipline_id: KICKBOXING, discipline_name: "Kickboxing", is_active: true, suspended_at: null },
      ]}
      attendanceStats={[
        { discipline_id: KARATE, present: 8, total: 10, percentage: 80 },
        { discipline_id: KICKBOXING, present: 6, total: 10, percentage: 60 },
      ]}
      progress={[
        { discipline_id: KARATE, discipline_name: "Karate", current_level_name: "Azul", current_level_color: "#1d4ed8" },
        { discipline_id: KICKBOXING, discipline_name: "Kickboxing", current_level_name: "Intermedio", current_level_color: null },
      ]}
      conduct={{ pending_fines_count: 0, pending_fines_total: 0, warnings_count: 0 }}
      {...props}
    />
  );
}

describe("StudentStatusStrip", () => {
  it("says the account is clear when there are no pending fines", () => {
    expect(render({})).toContain(STUDENT_STATUS_STRIP_MESSAGES.NO_FINES);
  });

  it("shows the pending fines with their total", () => {
    const html = render({
      conduct: { pending_fines_count: 2, pending_fines_total: 30, warnings_count: 0 },
    });

    expect(html).toContain(STUDENT_STATUS_STRIP_MESSAGES.FINES(2));
    expect(html).toContain(formatCurrency(30));
  });

  it("marks pending fines in carmine, never in the seal vermilion", () => {
    const html = render({
      conduct: { pending_fines_count: 1, pending_fines_total: 10, warnings_count: 0 },
    });

    expect(html).toContain("text-destructive");
    expect(html).not.toContain("text-seal");
  });

  it("shows warnings only when there are any", () => {
    expect(render({})).not.toContain(
      STUDENT_STATUS_STRIP_MESSAGES.WARNINGS(1)
    );
    expect(
      render({ conduct: { pending_fines_count: 0, pending_fines_total: 0, warnings_count: 1 } })
    ).toContain(STUDENT_STATUS_STRIP_MESSAGES.WARNINGS(1));
  });

  it("averages attendance across the active disciplines", () => {
    // 80% and 60% average to 70%.
    expect(render({})).toContain(
      STUDENT_STATUS_STRIP_MESSAGES.ATTENDANCE(70)
    );
  });

  it("says there are no attendance records instead of showing 0%", () => {
    const html = render({
      attendanceStats: [
        { discipline_id: KARATE, present: 0, total: 0, percentage: 0 },
      ],
    });

    expect(html).toContain(STUDENT_STATUS_STRIP_MESSAGES.NO_ATTENDANCE);
    expect(html).not.toContain(STUDENT_STATUS_STRIP_MESSAGES.ATTENDANCE(0));
  });

  it("names the current level of every active discipline", () => {
    const html = render({});

    expect(html).toContain("Azul");
    expect(html).toContain("Intermedio");
  });

  it("flags a suspension that still keeps the enrollment", () => {
    const html = render({
      enrollments: [
        {
          discipline_id: KARATE,
          discipline_name: "Karate",
          is_active: true,
          suspended_at: new Date("2026-10-01T00:00:00Z"),
        },
      ],
    });

    expect(html).toContain(STUDENT_STATUS_STRIP_MESSAGES.SUSPENDED);
  });

  it("ignores enrollments that are no longer active", () => {
    const html = render({
      enrollments: [
        { discipline_id: KARATE, discipline_name: "Karate", is_active: false, suspended_at: null },
      ],
      attendanceStats: [],
      progress: [],
    });

    expect(html).not.toContain("Azul");
    expect(html).toContain(STUDENT_STATUS_STRIP_MESSAGES.NO_ACTIVE_DISCIPLINES);
  });
});
