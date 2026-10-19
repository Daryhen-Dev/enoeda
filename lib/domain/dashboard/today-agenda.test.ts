import { describe, expect, it } from "vitest";

import type { SessionView } from "@/lib/domain/classes/actions";

import { buildTodayAgenda } from "./today-agenda";

function buildSession(
  overrides: Partial<SessionView> & { start_time: string }
): SessionView {
  return {
    scheduled_class_id: `class-${overrides.start_time}`,
    session_date: "2026-10-20",
    discipline_id: "discipline-1",
    discipline_name: "Karate",
    discipline_code: "karate",
    end_time: "19:00",
    teacher_id: "teacher-1",
    status: "scheduled",
    suspension_category: null,
    suspension_reason: null,
    is_substitute: false,
    is_one_time: false,
    ...overrides,
  };
}

describe("buildTodayAgenda", () => {
  it("sorts sessions by start_time ascending", () => {
    const agenda = buildTodayAgenda([
      buildSession({ start_time: "18:00" }),
      buildSession({ start_time: "07:00" }),
      buildSession({ start_time: "10:30" }),
    ]);

    expect(agenda.entries.map((entry) => entry.start_time)).toEqual([
      "07:00",
      "10:30",
      "18:00",
    ]);
  });

  it("does not mutate the input array", () => {
    const sessions = [
      buildSession({ start_time: "18:00" }),
      buildSession({ start_time: "07:00" }),
    ];

    buildTodayAgenda(sessions);

    expect(sessions.map((session) => session.start_time)).toEqual([
      "18:00",
      "07:00",
    ]);
  });

  it("marks a session with attendance records as sealed", () => {
    const agenda = buildTodayAgenda([
      buildSession({
        start_time: "08:00",
        attendance: { record_count: 12, present_count: 10 },
      }),
    ]);

    expect(agenda.entries[0]?.state).toBe("sealed");
    expect(agenda.counts).toEqual({
      total: 1,
      sealed: 1,
      pending: 0,
      suspended: 0,
    });
  });

  it("marks a scheduled session without attendance as pending", () => {
    const agenda = buildTodayAgenda([
      buildSession({ start_time: "09:00" }),
      buildSession({
        start_time: "10:00",
        attendance: { record_count: 0, present_count: 0 },
      }),
    ]);

    expect(agenda.entries.map((entry) => entry.state)).toEqual([
      "pending",
      "pending",
    ]);
    expect(agenda.counts.pending).toBe(2);
  });

  it("marks a suspended session as suspended even with prior attendance", () => {
    const agenda = buildTodayAgenda([
      buildSession({
        start_time: "16:00",
        status: "suspended",
        attendance: { record_count: 8, present_count: 7 },
      }),
    ]);

    expect(agenda.entries[0]?.state).toBe("suspended");
    expect(agenda.counts.suspended).toBe(1);
  });

  it("returns zeroed counts for an empty day", () => {
    const agenda = buildTodayAgenda([]);

    expect(agenda.entries).toEqual([]);
    expect(agenda.counts).toEqual({
      total: 0,
      sealed: 0,
      pending: 0,
      suspended: 0,
    });
  });

  it("counts mixed states independently", () => {
    const agenda = buildTodayAgenda([
      buildSession({
        start_time: "07:00",
        attendance: { record_count: 5, present_count: 4 },
      }),
      buildSession({ start_time: "09:00" }),
      buildSession({ start_time: "11:00", status: "suspended" }),
      buildSession({ start_time: "17:00" }),
    ]);

    expect(agenda.counts).toEqual({
      total: 4,
      sealed: 1,
      pending: 2,
      suspended: 1,
    });
  });
});
