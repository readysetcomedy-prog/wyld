-- Time clock + time cards. Lets employees punch in/out from the per-gym
-- dashboard, and lets managers see/edit everyone's hours under
-- Employees → Time Cards.
--
-- One row per shift (open while the employee is clocked in,
-- clock_out_at fills when they clock out). Manager edits stamp
-- edited_by + edited_at so payroll can audit.

create table if not exists public.time_card_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.gym_employees(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  location_id uuid references public.gym_locations(id) on delete set null,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  notes text,
  edited_by uuid references public.profiles(id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists time_card_entries_employee_idx
  on public.time_card_entries(employee_id, clock_in_at desc);
create index if not exists time_card_entries_gym_idx
  on public.time_card_entries(gym_id, clock_in_at desc);
-- Partial index so the "is there an open shift?" lookup is cheap.
create index if not exists time_card_entries_open_idx
  on public.time_card_entries(employee_id)
  where clock_out_at is null;

alter table public.time_card_entries enable row level security;

-- Owners + admins can read every entry for gyms they own. Managers
-- (employees flagged is_management OR perm_employees) at the gym can
-- read everyone's entries at that gym. Employees can always read their
-- own.
do $$
begin
  if not exists (select 1 from pg_policies where policyname='tc_read' and tablename='time_card_entries') then
    create policy "tc_read" on public.time_card_entries
      for select to authenticated using (
        public.is_admin()
        or public.owns_gym(gym_id)
        or exists (
          select 1 from public.gym_employees me
          where me.id = time_card_entries.employee_id
            and (me.user_id = auth.uid() or lower(me.email) = lower((select email from auth.users where id = auth.uid())))
        )
        or exists (
          select 1 from public.gym_employees mgr
          where mgr.gym_id = time_card_entries.gym_id
            and (mgr.user_id = auth.uid() or lower(mgr.email) = lower((select email from auth.users where id = auth.uid())))
            and (mgr.is_management or mgr.perm_employees)
            and (mgr.terminate_date is null or mgr.terminate_date > current_date)
        )
      );
  end if;
  -- Managers / owners / admins can edit + delete entries. Direct inserts
  -- aren't allowed by RLS — employees go through the RPCs below, which
  -- run as security-definer.
  if not exists (select 1 from pg_policies where policyname='tc_write_manager' and tablename='time_card_entries') then
    create policy "tc_write_manager" on public.time_card_entries
      for all to authenticated
      using (
        public.is_admin()
        or public.owns_gym(gym_id)
        or exists (
          select 1 from public.gym_employees mgr
          where mgr.gym_id = time_card_entries.gym_id
            and (mgr.user_id = auth.uid() or lower(mgr.email) = lower((select email from auth.users where id = auth.uid())))
            and (mgr.is_management or mgr.perm_employees)
            and (mgr.terminate_date is null or mgr.terminate_date > current_date)
        )
      )
      with check (
        public.is_admin()
        or public.owns_gym(gym_id)
        or exists (
          select 1 from public.gym_employees mgr
          where mgr.gym_id = time_card_entries.gym_id
            and (mgr.user_id = auth.uid() or lower(mgr.email) = lower((select email from auth.users where id = auth.uid())))
            and (mgr.is_management or mgr.perm_employees)
            and (mgr.terminate_date is null or mgr.terminate_date > current_date)
        )
      );
  end if;
end $$;


-- ---- Employee-facing RPCs ----------------------------------------------

-- Punch in. Finds the active gym_employees row for the caller at p_gym_id,
-- refuses if there's already an open entry, otherwise creates a new one.
-- Returns the new row.
create or replace function public.time_card_clock_in(
  p_gym_id uuid,
  p_location_id uuid default null
)
returns public.time_card_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  my_email text;
  emp_row public.gym_employees;
  has_open uuid;
  new_row public.time_card_entries;
begin
  select email into my_email from auth.users where id = auth.uid();
  select * into emp_row from public.gym_employees
   where gym_id = p_gym_id
     and (user_id = auth.uid() or lower(email) = lower(my_email))
     and (terminate_date is null or terminate_date > current_date)
   order by created_at desc
   limit 1;
  if emp_row.id is null then
    raise exception 'You are not an active employee at this gym';
  end if;
  select id into has_open from public.time_card_entries
   where employee_id = emp_row.id and clock_out_at is null
   limit 1;
  if has_open is not null then
    raise exception 'You already have an open shift — clock out first';
  end if;

  insert into public.time_card_entries (employee_id, gym_id, location_id)
  values (emp_row.id, p_gym_id, p_location_id)
  returning * into new_row;
  return new_row;
end;
$$;
grant execute on function public.time_card_clock_in(uuid, uuid) to authenticated;

-- Punch out. Closes the caller's open shift at p_gym_id (if any).
create or replace function public.time_card_clock_out(p_gym_id uuid)
returns public.time_card_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  my_email text;
  emp_row public.gym_employees;
  open_row public.time_card_entries;
begin
  select email into my_email from auth.users where id = auth.uid();
  select * into emp_row from public.gym_employees
   where gym_id = p_gym_id
     and (user_id = auth.uid() or lower(email) = lower(my_email))
     and (terminate_date is null or terminate_date > current_date)
   order by created_at desc
   limit 1;
  if emp_row.id is null then
    raise exception 'You are not an active employee at this gym';
  end if;
  update public.time_card_entries
     set clock_out_at = now()
   where employee_id = emp_row.id
     and clock_out_at is null
   returning * into open_row;
  if open_row.id is null then
    raise exception 'No open shift to clock out from';
  end if;
  return open_row;
end;
$$;
grant execute on function public.time_card_clock_out(uuid) to authenticated;
