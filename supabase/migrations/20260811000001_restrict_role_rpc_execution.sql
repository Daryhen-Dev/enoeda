-- U2 correction: project-level default privileges grant new functions to anon
-- and service_role. Role-management RPCs must remain authenticated-only.

revoke execute on function public.current_roles() from public, anon, service_role;
revoke execute on function public.grant_role(uuid, public.role_enum)
  from public, anon, service_role;
revoke execute on function public.revoke_role(uuid, public.role_enum)
  from public, anon, service_role;

grant execute on function public.current_roles() to authenticated;
grant execute on function public.grant_role(uuid, public.role_enum) to authenticated;
grant execute on function public.revoke_role(uuid, public.role_enum) to authenticated;
