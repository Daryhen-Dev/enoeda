-- 20260817000000_scheduled_classes_sessions.sql
-- Scheduled classes (recurring weekly template) + class sessions (exception instances).
-- Anti-overlap via EXCLUDE USING gist (per-branch). Teacher conflict: application-level.
-- Branch-scoped RLS via scheduled_class. Authority: Supabase SQL migration (sole DDL owner).

BEGIN;

-- 0. Required extension for combining = and && in a single GiST index
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 0b. Custom time-of-day range type for the anti-overlap exclusion
DO $$ BEGIN
  CREATE TYPE public.class_time_range AS RANGE (subtype = time);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. scheduled_classes (recurring weekly template)
CREATE TABLE public.scheduled_classes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id          uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  discipline_id      uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  default_teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  day_of_week        smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time         time NOT NULL,
  end_time           time GENERATED ALWAYS AS (start_time + interval '1 hour') STORED,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_classes_no_overlap EXCLUDE USING gist (
    branch_id WITH =,
    day_of_week WITH =,
    public.class_time_range(start_time, (start_time + interval '1 hour')::time, '[)') WITH &&
  ) WHERE (is_active = true)
);
CREATE INDEX scheduled_classes_branch_id_idx ON public.scheduled_classes (branch_id);
CREATE INDEX scheduled_classes_discipline_id_idx ON public.scheduled_classes (discipline_id);
CREATE INDEX scheduled_classes_teacher_id_idx ON public.scheduled_classes (default_teacher_id);

-- 2. class_sessions (materialized exceptions — NEVER cascade-deleted)
CREATE TABLE public.class_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_class_id  uuid NOT NULL REFERENCES public.scheduled_classes(id) ON DELETE RESTRICT,
  session_date        date NOT NULL,
  assigned_teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','suspended')),
  suspension_category text CHECK (suspension_category IN ('feriado','evento','emergencia','otro')),
  suspension_reason   text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_sessions_pair_uq UNIQUE (scheduled_class_id, session_date),
  CONSTRAINT chk_suspended_has_category
    CHECK (status <> 'suspended' OR suspension_category IS NOT NULL),
  CONSTRAINT chk_otro_has_reason
    CHECK (suspension_category <> 'otro' OR suspension_reason IS NOT NULL),
  CONSTRAINT chk_scheduled_no_suspension
    CHECK (status <> 'scheduled' OR (suspension_category IS NULL AND suspension_reason IS NULL))
);
CREATE INDEX class_sessions_scheduled_class_id_idx ON public.class_sessions (scheduled_class_id);
CREATE INDEX class_sessions_status_date_idx ON public.class_sessions (status, session_date);
CREATE INDEX class_sessions_teacher_id_idx ON public.class_sessions (assigned_teacher_id);

-- 3. updated_at triggers (reuse existing public.set_updated_at)
CREATE TRIGGER scheduled_classes_updated_at
  BEFORE UPDATE ON public.scheduled_classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER class_sessions_updated_at
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. private.scheduled_class_branch_id(uuid) — resolve branch for session RLS
CREATE OR REPLACE FUNCTION private.scheduled_class_branch_id(p_scheduled_class_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT branch_id FROM public.scheduled_classes WHERE id = p_scheduled_class_id;
$$;
REVOKE EXECUTE ON FUNCTION private.scheduled_class_branch_id(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.scheduled_class_branch_id(uuid) TO authenticated;

-- 5. RLS: scheduled_classes
ALTER TABLE public.scheduled_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_classes FORCE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on scheduled_classes"
  ON public.scheduled_classes FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

CREATE POLICY "Admin branch-scoped write on scheduled_classes"
  ON public.scheduled_classes FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id));

CREATE POLICY "Admin global read on scheduled_classes"
  ON public.scheduled_classes FOR SELECT TO authenticated
  USING (private.has_any_admin_role(auth.uid()));

CREATE POLICY "Teacher branch-scoped read on scheduled_classes"
  ON public.scheduled_classes FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, branch_id));

-- 6. RLS: class_sessions (branch resolved via parent scheduled_class)
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on class_sessions"
  ON public.class_sessions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

CREATE POLICY "Admin branch-scoped write on class_sessions"
  ON public.class_sessions FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.scheduled_class_branch_id(scheduled_class_id)))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.scheduled_class_branch_id(scheduled_class_id)));

CREATE POLICY "Admin global read on class_sessions"
  ON public.class_sessions FOR SELECT TO authenticated
  USING (private.has_any_admin_role(auth.uid()));

CREATE POLICY "Teacher branch-scoped read on class_sessions"
  ON public.class_sessions FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.scheduled_class_branch_id(scheduled_class_id)));

-- 7. Grants (defense in depth; RLS is the authority)
REVOKE INSERT, UPDATE, DELETE ON public.scheduled_classes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.class_sessions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated;

COMMIT;
