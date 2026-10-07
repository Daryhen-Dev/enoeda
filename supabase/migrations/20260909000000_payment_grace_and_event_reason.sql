-- Monthly payment validation prerequisites
--
-- Capabilities realized:
--   - public.branches.payment_grace_days: per-branch tolerance (in days)
--     after the monthly due date before an overdue enrollment becomes a
--     suspension candidate. Part of the payment settings surface, managed
--     alongside payment_due_day / payment_edit_window_days through the same
--     raw-SQL settings actions (admins already hold table-level UPDATE on
--     public.branches, so no extra column grant is required).
--   - public.discipline_events.reason: optional classification of lifecycle
--     events. Suspension candidates bulk-suspended for non-payment are
--     recorded with reason 'non_payment'; direct manual suspensions may use
--     'manual'. Existing rows keep reason NULL.

BEGIN;

ALTER TABLE public.branches
  ADD COLUMN payment_grace_days smallint NOT NULL DEFAULT 0,
  ADD CONSTRAINT branches_payment_grace_days_ck CHECK (payment_grace_days BETWEEN 0 AND 60);

ALTER TABLE public.discipline_events
  ADD COLUMN reason text,
  ADD CONSTRAINT discipline_events_reason_ck CHECK (reason IS NULL OR reason IN ('non_payment', 'manual'));

COMMENT ON COLUMN public.discipline_events.reason IS
  'Optional event classification; suspensions may record non_payment (bulk overdue suspension) or manual (direct admin action)';

COMMIT;
