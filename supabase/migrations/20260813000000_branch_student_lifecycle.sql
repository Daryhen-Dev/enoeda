-- Enforce the Branch–Student lifecycle invariant without rewriting legacy data.
-- Active students must reference active branches, and branches with active
-- students cannot be deactivated.

do $$
declare
  invalid_assignment_count integer;
begin
  select count(*)
  into invalid_assignment_count
  from public.students as student
  inner join public.branches as branch
    on branch.id = student.branch_id
  where student.is_active
    and not branch.is_active;

  if invalid_assignment_count > 0 then
    raise exception
      'Cannot install branch-student lifecycle invariant while active students are assigned to inactive branches'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.enforce_active_student_branch()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_branch_is_active boolean;
begin
  if new.is_active then
    select branch.is_active
    into target_branch_is_active
    from public.branches as branch
    where branch.id = new.branch_id
    for update;

    if not found then
      raise exception 'Active students must be assigned to an existing branch'
        using errcode = '23514';
    end if;

    if target_branch_is_active is not true then
      raise exception 'Active students must be assigned to an active branch'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_branch_deactivation_with_active_students()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active then
    if exists (
      select 1
      from public.students as student
      where student.branch_id = new.id
        and student.is_active
    ) then
      raise exception 'Cannot deactivate a branch with active students'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists students_enforce_active_branch on public.students;
create trigger students_enforce_active_branch
before insert or update of branch_id, is_active on public.students
for each row
execute function public.enforce_active_student_branch();

drop trigger if exists branches_prevent_deactivation_with_active_students on public.branches;
create trigger branches_prevent_deactivation_with_active_students
before update of is_active on public.branches
for each row
execute function public.prevent_branch_deactivation_with_active_students();
