# Feature: date-only-writes

Follow-up of #231 and #233. Postgres `date` columns keep only the UTC calendar
day of the instant they receive. Several writers and filters still build
**local** midnight (`parseDateOnly`, `new Date(day + "T00:00:00")`), which is
right only on servers at or west of UTC. On any server east of UTC the stored
day moves back one.

## Specs

S1 — Every value written to, or compared against, a Postgres `date` column is
the UTC-midnight instant of its calendar day (`dateOnlyToUtcDate`), whatever
the server timezone.

S2 — In-memory calendar arithmetic (weekday of a session, month spans, the
months a payment covers, schema validation) keeps local-time `parseDateOnly`;
only the value that crosses into Prisma changes.

S3 — Behaviour is unchanged where the code already works: the guest "future
session" and "30-day capture window" (CAPTURE_WINDOW_DAYS) rules compare calendar days, and keep
doing so.

## Tasks

- [x] T1 — Class payments `class_date` (register + correct) (S1)
- [x] T2 — Promotion `promoted_at` (S1)
- [x] T3 — Attendance session lookups `session_date` (S1, S2)
- [x] T4 — Guests `session_date` + calendar-day guards (S1, S3)
- [x] T5 — Classes resolver filters `class_date` / `session_date` (S1, S2)
- [x] T6 — Attendance history range filter `session_date` (S1)

## Log

L1 (user, verbatim): "vamos con el 1 entonces"

L2 (classification): 19 uses found. Left as-is because they never reach
Prisma (S2): `payments/reconciliation.ts:100`, `payments/schema.ts:12,22,23,38,39`,
`classes/actions.ts:1187,1188` (range bounds used to walk weekdays).

L3 (risk): in guests and attendance the same `sessionDate` feeds both a
Prisma filter and a weekday check / a comparison with local "today". The
weekday must stay local and the Prisma value must be UTC, so they are split
into two variables instead of converting one.

L4 (finding, T3/T4): for a ONE-TIME class, `session-authorization.ts` builds
`sessionDate = new Date(oneTimeClass.class_date); sessionDate.setHours(0,0,0,0)`.
`class_date` arrives from Prisma as UTC midnight; on a server at UTC-5 that is
19:00 of the previous local day, so `setHours(0)` moves it to the previous day
(2026-10-26T00:00Z -> 2026-10-25T05:00Z, stored day 25). This one is wrong in
Ecuador already, not only east of UTC. Consumers: takeAttendance writes
(attendance rows), the guest create, and the "future session" / "capture
window" guards. Correction to an earlier statement: one-time class attendance
or guests written through a server running at UTC-5 (local dev against the
shared database) may already be stored one day early. Not verified against
the data.

L5 (decision, S3): guards compare calendar days. The server-local "today"
semantics stay as they are; both sides of every comparison become the
UTC-midnight instant of their calendar day, so the difference is an exact
number of days.

L6 (correction): S3 said "7-day capture window"; the real value is
`CAPTURE_WINDOW_DAYS = 30` (lib/domain/attendance/schema.ts:189). S3 is
reworded; the behaviour was always 30 days and is unchanged.

L7 (evidence, T3/T4, delegated): RED reproduced the L4 bug on this UTC-5
machine — a one-time class stored for 2026-10-26 was written as
2026-10-25T05:00:00.000Z (attendance, per-class add and guest create).
GREEN: 71 focused tests, full suite 1627 passed. Two guest tests pinned the
shifted value and were updated. Already-shifted rows are not backfilled.

L8 (evidence, T5): the range bounds, the inactive one-time "before today"
gate and the attendance lookup now send UTC midnight; the day-by-day walk
keeps local `parseDateOnly` (S2). RED: all four Prisma values arrived as
T05:00Z. Second bug found and fixed in the same function: a one-time class
`class_date` read back from Prisma was turned into `session_date` with
`formatDateOnly` (local getters), so a class stored for 10 sept rendered on
9 sept in Ecuador — already wrong at UTC-5, like L4. Now
`formatDatabaseDateOnly`. The resolver test fixture built `class_date` as
local midnight, which hid it; it now builds the UTC instant Prisma returns.
139 class tests green.

L9 (evidence, T6): `getAttendanceStats` range bounds now `dateOnlyToUtcDate`.
RED: gte/lte arrived as T05:00Z. 44 attendance tests green. Final sweep of
lib/domain finds only the S2 uses listed in L2 (in-memory calendar
arithmetic), plus a comment in session-authorization.ts.

L10 (verification): full suite 1636 passed, 1 skipped, 0 failed; tsc and
eslint clean. Real database, read-only: `SHOW TimeZone` = UTC, and
`'2026-10-26T00:00:00.000Z'::timestamptz::date` = 2026-10-26, so the
`$queryRaw` `::date` parameters receive the right day. Not shown in the
browser: the branch has no one-time classes, so the L4/L8 one-time cases are
covered by tests only. Already-shifted rows are not backfilled.
