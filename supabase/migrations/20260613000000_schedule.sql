-- Schedule manager: shifts assigned to a gym location, with per-location
-- coverage targets, full history, pickup requests, absences, and per-user
-- filter persistence. Modeled on the EMS app's schedule but stripped of
-- "basket" / EMT-specific bits — for us, locations are the lanes and an
-- employee's gym_employees.position is the role.

-- ---- 1. Feature gate + permission ---------------------------------------
alter table public.gym_modules
  add column if not exists schedule_enabled boolean not null default false;

alter table public.gym_employees
  add column if not exists perm_schedule boolean not null default false;

-- ---- 2. Per-location schedule settings ----------------------------------
alter table public.gym_locations
  add column if not exists sched_required_hours numeric not null default 0,
  add column if not exists sched_visible_until_date date;

-- ---- 3. Helper: can the current user manage this gym's schedule? --------
-- Owners (or admins) always can. Otherwise, an active gym_employee on this
-- gym with perm_schedule = true.
create or replace function public.can_manage_schedule(p_gym_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or public.owns_gym(p_gym_id)
    or exists (
      select 1
        from public.gym_employees e
       where e.gym_id = p_gym_id
         and e.user_id = auth.uid()
         and e.perm_schedule = true
         and (e.terminate_date is null or e.terminate_date > current_date)
    );
$$;
grant execute on function public.can_manage_schedule(uuid) to authenticated;

-- ---- 4. Helper: is the current user an employee of this gym? ------------
create or replace function public.is_gym_employee(p_gym_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.gym_employees e
     where e.gym_id = p_gym_id
       and (e.user_id = auth.uid()
            or lower(e.email) = lower((select email from public.profiles where id = auth.uid())))
       and (e.terminate_date is null or e.terminate_date > current_date)
  );
$$;
grant execute on function public.is_gym_employee(uuid) to authenticated;

-- ---- 5. Shifts ----------------------------------------------------------
create table if not exists public.schedule_shifts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  location_id uuid not null references public.gym_locations(id) on delete cascade,
  employee_id uuid not null references public.gym_employees(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  is_next_day boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists schedule_shifts_gym_date_idx
  on public.schedule_shifts(gym_id, shift_date);
create index if not exists schedule_shifts_location_date_idx
  on public.schedule_shifts(location_id, shift_date);
create index if not exists schedule_shifts_employee_idx
  on public.schedule_shifts(employee_id, shift_date);

drop trigger if exists schedule_shifts_set_updated_at on public.schedule_shifts;
create trigger schedule_shifts_set_updated_at
  before update on public.schedule_shifts
  for each row execute function public.set_updated_at();

alter table public.schedule_shifts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='schedule_shifts_read' and tablename='schedule_shifts') then
    create policy "schedule_shifts_read" on public.schedule_shifts
      for select to authenticated using (
        public.can_manage_schedule(gym_id) or public.is_gym_employee(gym_id)
      );
  end if;
  if not exists (select 1 from pg_policies where policyname='schedule_shifts_write' and tablename='schedule_shifts') then
    create policy "schedule_shifts_write" on public.schedule_shifts
      for all to authenticated
      using (public.can_manage_schedule(gym_id))
      with check (public.can_manage_schedule(gym_id));
  end if;
end $$;

-- ---- 6. Change history --------------------------------------------------
create table if not exists public.schedule_history (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid,  -- nullable: shift may have been deleted
  action_type text not null,
  employee_id uuid references public.gym_employees(id) on delete set null,
  location_id uuid references public.gym_locations(id) on delete set null,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  changed_by_user_id uuid references auth.users(id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists schedule_history_gym_time_idx
  on public.schedule_history(gym_id, created_at desc);

alter table public.schedule_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='schedule_history_read' and tablename='schedule_history') then
    create policy "schedule_history_read" on public.schedule_history
      for select to authenticated using (public.can_manage_schedule(gym_id));
  end if;
  if not exists (select 1 from pg_policies where policyname='schedule_history_insert' and tablename='schedule_history') then
    create policy "schedule_history_insert" on public.schedule_history
      for insert to authenticated with check (public.can_manage_schedule(gym_id));
  end if;
end $$;

-- ---- 7. Pickup requests -------------------------------------------------
create table if not exists public.shift_pickup_requests (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  location_id uuid not null references public.gym_locations(id) on delete cascade,
  employee_id uuid not null references public.gym_employees(id) on delete cascade,
  shift_date date not null,
  requested_start_time time not null,
  requested_end_time time not null,
  is_next_day boolean not null default false,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','approved','denied')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists shift_pickup_requests_gym_status_idx
  on public.shift_pickup_requests(gym_id, status, created_at desc);

alter table public.shift_pickup_requests enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='shift_pickup_read' and tablename='shift_pickup_requests') then
    create policy "shift_pickup_read" on public.shift_pickup_requests
      for select to authenticated using (
        public.can_manage_schedule(gym_id)
        or exists (
          select 1 from public.gym_employees e
           where e.id = employee_id and e.user_id = auth.uid()
        )
      );
  end if;
  -- Employees insert their own; managers can insert on anyone's behalf.
  if not exists (select 1 from pg_policies where policyname='shift_pickup_insert' and tablename='shift_pickup_requests') then
    create policy "shift_pickup_insert" on public.shift_pickup_requests
      for insert to authenticated with check (
        public.can_manage_schedule(gym_id)
        or exists (
          select 1 from public.gym_employees e
           where e.id = employee_id and e.user_id = auth.uid()
        )
      );
  end if;
  -- Only managers approve/deny.
  if not exists (select 1 from pg_policies where policyname='shift_pickup_update' and tablename='shift_pickup_requests') then
    create policy "shift_pickup_update" on public.shift_pickup_requests
      for update to authenticated
      using (public.can_manage_schedule(gym_id))
      with check (public.can_manage_schedule(gym_id));
  end if;
end $$;

-- ---- 8. Absences --------------------------------------------------------
create table if not exists public.schedule_absences (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  location_id uuid not null references public.gym_locations(id) on delete cascade,
  employee_id uuid not null references public.gym_employees(id) on delete cascade,
  shift_date date not null,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists schedule_absences_gym_date_idx
  on public.schedule_absences(gym_id, shift_date);

alter table public.schedule_absences enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='schedule_absences_read' and tablename='schedule_absences') then
    create policy "schedule_absences_read" on public.schedule_absences
      for select to authenticated using (
        public.can_manage_schedule(gym_id) or public.is_gym_employee(gym_id)
      );
  end if;
  if not exists (select 1 from pg_policies where policyname='schedule_absences_write' and tablename='schedule_absences') then
    create policy "schedule_absences_write" on public.schedule_absences
      for all to authenticated
      using (public.can_manage_schedule(gym_id))
      with check (public.can_manage_schedule(gym_id));
  end if;
end $$;

-- ---- 9. Per-manager filter persistence ----------------------------------
create table if not exists public.schedule_manager_filters (
  manager_user_id uuid not null references auth.users(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  visible_location_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (manager_user_id, gym_id)
);

alter table public.schedule_manager_filters enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='sched_filters_own' and tablename='schedule_manager_filters') then
    create policy "sched_filters_own" on public.schedule_manager_filters
      for all to authenticated
      using (manager_user_id = auth.uid())
      with check (manager_user_id = auth.uid());
  end if;
end $$;
