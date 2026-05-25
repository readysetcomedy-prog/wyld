-- Hardening for the time-clock RPCs + RLS.
--
-- 1) Switch every `(select email from auth.users where id = auth.uid())`
--    to the built-in auth.email(). The subquery is a recurring footgun
--    because RLS evaluation can hit grant issues / empty results
--    depending on the JWT shape, and auth.email() reads the email out
--    of the current request's JWT directly — no auth.users lookup
--    needed.
--
-- 2) Make both RPCs `returns setof time_card_entries` so PostgREST
--    returns a JSON array (always defined) instead of a single
--    composite that supabase-js sometimes unwraps inconsistently.

-- ---- RLS rebuild ------------------------------------------------------

drop policy if exists "tc_read" on public.time_card_entries;
create policy "tc_read" on public.time_card_entries
  for select to authenticated using (
    public.is_admin()
    or public.owns_gym(gym_id)
    or exists (
      select 1 from public.gym_employees me
      where me.id = time_card_entries.employee_id
        and (me.user_id = auth.uid() or lower(me.email) = lower(coalesce(auth.email(), '')))
    )
    or exists (
      select 1 from public.gym_employees mgr
      where mgr.gym_id = time_card_entries.gym_id
        and (mgr.user_id = auth.uid() or lower(mgr.email) = lower(coalesce(auth.email(), '')))
        and (mgr.is_management or mgr.perm_employees)
        and (mgr.terminate_date is null or mgr.terminate_date > current_date)
    )
  );

drop policy if exists "tc_write_manager" on public.time_card_entries;
create policy "tc_write_manager" on public.time_card_entries
  for all to authenticated
  using (
    public.is_admin()
    or public.owns_gym(gym_id)
    or exists (
      select 1 from public.gym_employees mgr
      where mgr.gym_id = time_card_entries.gym_id
        and (mgr.user_id = auth.uid() or lower(mgr.email) = lower(coalesce(auth.email(), '')))
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
        and (mgr.user_id = auth.uid() or lower(mgr.email) = lower(coalesce(auth.email(), '')))
        and (mgr.is_management or mgr.perm_employees)
        and (mgr.terminate_date is null or mgr.terminate_date > current_date)
    )
  );

-- ---- RPC rebuilds: setof return + auth.email() lookup -----------------

drop function if exists public.time_card_clock_in(uuid, uuid);
create or replace function public.time_card_clock_in(
  p_gym_id uuid,
  p_location_id uuid default null
)
returns setof public.time_card_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  my_email text;
  emp_row public.gym_employees;
  has_open uuid;
  new_id uuid;
begin
  my_email := coalesce(auth.email(), '');
  select * into emp_row from public.gym_employees
   where gym_id = p_gym_id
     and (user_id = auth.uid() or lower(email) = lower(my_email))
     and (terminate_date is null or terminate_date > current_date)
   order by created_at desc
   limit 1;
  if emp_row.id is null then
    raise exception 'You are not on this gym''s staff roster (no active employee record for %).', my_email;
  end if;
  select id into has_open from public.time_card_entries
   where employee_id = emp_row.id and clock_out_at is null
   limit 1;
  if has_open is not null then
    raise exception 'You already have an open shift — clock out first.';
  end if;
  insert into public.time_card_entries (employee_id, gym_id, location_id)
  values (emp_row.id, p_gym_id, p_location_id)
  returning id into new_id;
  return query select * from public.time_card_entries where id = new_id;
end;
$$;
grant execute on function public.time_card_clock_in(uuid, uuid) to authenticated;

drop function if exists public.time_card_clock_out(uuid);
create or replace function public.time_card_clock_out(p_gym_id uuid)
returns setof public.time_card_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  my_email text;
  emp_row public.gym_employees;
  closed_id uuid;
begin
  my_email := coalesce(auth.email(), '');
  select * into emp_row from public.gym_employees
   where gym_id = p_gym_id
     and (user_id = auth.uid() or lower(email) = lower(my_email))
     and (terminate_date is null or terminate_date > current_date)
   order by created_at desc
   limit 1;
  if emp_row.id is null then
    raise exception 'You are not on this gym''s staff roster (no active employee record for %).', my_email;
  end if;
  update public.time_card_entries
     set clock_out_at = now()
   where employee_id = emp_row.id
     and clock_out_at is null
   returning id into closed_id;
  if closed_id is null then
    raise exception 'You don''t have an open shift to clock out from.';
  end if;
  return query select * from public.time_card_entries where id = closed_id;
end;
$$;
grant execute on function public.time_card_clock_out(uuid) to authenticated;

-- ---- Realtime --------------------------------------------------------
-- Add the table to the supabase_realtime publication so the manager
-- Time Cards view and the employee Time Clock view both light up
-- immediately when anyone punches in / out or a manager edits a row.
do $$
begin
  begin
    alter publication supabase_realtime add table public.time_card_entries;
  exception when duplicate_object then
    -- already in the publication
    null;
  end;
end $$;
