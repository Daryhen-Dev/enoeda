-- U3: Branches and Students
-- Authority: Supabase SQL migration (sole DDL owner)

-- 1. Branches table
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  time_zone text not null default 'America/Guayaquil',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branches_time_zone_ck check (time_zone in ('America/Guayaquil', 'Pacific/Galapagos'))
);

create unique index branches_name_uq on public.branches (lower(name))
  where is_active = true;

comment on table public.branches is 'Academy branches/locations';

-- 2. Students table
create table public.students (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  first_name text not null,
  surname text not null,
  national_id text not null,
  email text not null,
  date_of_birth date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Globally unique national ID (spec requirement)
create unique index students_national_id_uq on public.students (national_id);

create index students_branch_id_idx on public.students (branch_id);
create index students_email_idx on public.students (email);

comment on table public.students is 'Student profiles with globally unique national ID';

-- 3. Auto-update updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger branches_updated_at
  before update on public.branches
  for each row execute function public.set_updated_at();

create trigger students_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- 4. RLS: Branches (Admin full CRUD, Teacher read-only)
alter table public.branches enable row level security;
alter table public.branches force row level security;

-- Admin: full access
create policy "Admin full access on branches"
  on public.branches for all to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.role_enum))
  with check (private.has_role(auth.uid(), 'admin'::public.role_enum));

-- Teacher: read-only
create policy "Teacher read branches"
  on public.branches for select to authenticated
  using (private.has_role(auth.uid(), 'teacher'::public.role_enum));

-- 5. RLS: Students (Admin full CRUD, Teacher read-only)
alter table public.students enable row level security;
alter table public.students force row level security;

-- Admin: full access
create policy "Admin full access on students"
  on public.students for all to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.role_enum))
  with check (private.has_role(auth.uid(), 'admin'::public.role_enum));

-- Teacher: read-only
create policy "Teacher read students"
  on public.students for select to authenticated
  using (private.has_role(auth.uid(), 'teacher'::public.role_enum));

-- 6. Revoke direct DML from anon (defense in depth)
revoke insert, update, delete on public.branches from anon;
revoke insert, update, delete on public.students from anon;
grant select, insert, update, delete on public.branches to authenticated;
grant select, insert, update, delete on public.students to authenticated;
