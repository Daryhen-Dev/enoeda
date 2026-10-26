/**
 * Calendar default view — S3 contract.
 *
 * A teacher-only user opens the calendar on the day they are teaching today; an
 * admin keeps the month overview. An explicit `?view=` always wins, so links,
 * bookmarks and the view switcher keep working for both roles.
 */

import { describe, expect, it } from "vitest";

import {
  CALENDAR_VIEWS,
  resolveCalendarView,
  type CalendarRoleFlags,
} from "./calendar-view";

const TEACHER: CalendarRoleFlags = { isTeacherOnly: true };
const ADMIN: CalendarRoleFlags = { isTeacherOnly: false };

describe("resolveCalendarView", () => {
  it("opens on the day view for a teacher-only user", () => {
    expect(resolveCalendarView(undefined, TEACHER)).toBe(CALENDAR_VIEWS.DAY);
  });

  it("opens on the month view for an admin", () => {
    expect(resolveCalendarView(undefined, ADMIN)).toBe(CALENDAR_VIEWS.MONTH);
  });

  it("honours an explicit view for a teacher-only user", () => {
    expect(resolveCalendarView("week", TEACHER)).toBe(CALENDAR_VIEWS.WEEK);
    expect(resolveCalendarView("month", TEACHER)).toBe(CALENDAR_VIEWS.MONTH);
  });

  it("honours an explicit view for an admin", () => {
    expect(resolveCalendarView("day", ADMIN)).toBe(CALENDAR_VIEWS.DAY);
    expect(resolveCalendarView("week", ADMIN)).toBe(CALENDAR_VIEWS.WEEK);
  });

  it("ignores an unknown view param instead of rendering nothing", () => {
    expect(resolveCalendarView("quarter", TEACHER)).toBe(CALENDAR_VIEWS.DAY);
    expect(resolveCalendarView("", ADMIN)).toBe(CALENDAR_VIEWS.MONTH);
    expect(resolveCalendarView("DAY", ADMIN)).toBe(CALENDAR_VIEWS.MONTH);
  });
});
