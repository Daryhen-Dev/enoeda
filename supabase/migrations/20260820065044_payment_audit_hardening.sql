BEGIN;

DROP POLICY IF EXISTS "Admin branch-scoped payment audit insert" ON public.payment_audit_entries;

CREATE INDEX IF NOT EXISTS payment_audit_entries_actor_id_idx
  ON public.payment_audit_entries (actor_id)
  WHERE actor_id IS NOT NULL;

COMMIT;
