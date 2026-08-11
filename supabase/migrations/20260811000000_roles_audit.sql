-- U2: Roles and authorization RPCs

-- 1. Role enum
create type public.role_enum as enum ('admin', 'teacher');

-- 2. user_roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.role_enum not null,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz
);

-- Active role: one active per (user_id, role)
create unique index user_roles_active_uq
  on public.user_roles (user_id, role)
  where revoked_at is null;

create index user_roles_user_id_idx on public.user_roles (user_id);

-- 3. Private schema + has_role helper
create schema if not exists private;

create or replace function private.has_role(p_user_id uuid, p_role public.role_enum)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = p_role and revoked_at is null
  );
$$;

revoke execute on function private.has_role(uuid, public.role_enum) from public;
grant execute on function private.has_role(uuid, public.role_enum) to authenticated;

-- 4. RLS: deny ALL direct client DML
alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;

create policy "Users can read own active roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() and revoked_at is null);

create policy "Admin can read all roles"
  on public.user_roles for select to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.role_enum));

-- 5. Revoke DML privileges (no insert/update/delete policies → direct DML denied)
revoke insert, update, delete on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

-- 6. public.current_roles
create or replace function public.current_roles()
returns setof public.role_enum
language sql stable security definer set search_path = ''
as $$
  select role from public.user_roles
  where user_id = auth.uid() and revoked_at is null;
$$;

revoke execute on function public.current_roles() from public;
grant execute on function public.current_roles() to authenticated;

-- 7. public.grant_role (Admin-only, records assignment authorship)
create or replace function public.grant_role(p_target_user_id uuid, p_role public.role_enum)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.has_role(auth.uid(), 'admin') then
    raise exception 'unauthorized: admin role required';
  end if;

  select id into v_id from public.user_roles
  where user_id = p_target_user_id and role = p_role and revoked_at is null;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.user_roles (user_id, role, assigned_by)
  values (p_target_user_id, p_role, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.grant_role(uuid, public.role_enum) from public;
grant execute on function public.grant_role(uuid, public.role_enum) to authenticated;

-- 8. public.revoke_role (Admin-only, soft revoke)
create or replace function public.revoke_role(p_target_user_id uuid, p_role public.role_enum)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.has_role(auth.uid(), 'admin') then
    raise exception 'unauthorized: admin role required';
  end if;

  update public.user_roles
  set revoked_by = auth.uid(), revoked_at = now()
  where user_id = p_target_user_id and role = p_role and revoked_at is null;

  return found;
end;
$$;

revoke execute on function public.revoke_role(uuid, public.role_enum) from public;
grant execute on function public.revoke_role(uuid, public.role_enum) to authenticated;
