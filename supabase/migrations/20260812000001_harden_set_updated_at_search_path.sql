-- U3 hardening: fix mutable search_path on public.set_updated_at()
-- Advisor finding: function has no explicit search_path, making it vulnerable
-- to search_path manipulation attacks.
-- Convention: set search_path = '' (matches U2 private.has_role and all RPCs).
-- This CREATE OR REPLACE preserves the function OID and all existing trigger
-- references (branches_updated_at, students_updated_at) without recreation.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
