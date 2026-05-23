-- Member-side profile + members-page support.

-- Profile picture on the cross-gym profile (used by messages and surfaced in
-- per-gym employee profiles too).
alter table public.profiles
  add column if not exists avatar_url text;

-- Staff-private notes on a member at a specific gym. Visible to owner/admins,
-- not to the member themselves.
alter table public.gym_memberships
  add column if not exists notes text;

-- Owners can read profiles of members at their gyms (so the Members roster
-- can show full_name / avatar / email). RLS on profiles is normally just
-- "you can read yourself"; this opens it up for the join.
do $$
begin
  if not exists (select 1 from pg_policies where policyname='profiles_visible_to_gym_owner' and tablename='profiles') then
    create policy "profiles_visible_to_gym_owner" on public.profiles
      for select to authenticated using (
        public.is_admin()
        or exists (
          select 1 from public.gym_memberships m
            join public.gyms g on g.id = m.gym_id
           where m.member_id = profiles.id
             and g.owner_id = auth.uid()
        )
        or exists (
          select 1 from public.gym_employees e
            join public.gyms g on g.id = e.gym_id
           where e.user_id = profiles.id
             and g.owner_id = auth.uid()
        )
      );
  end if;
end $$;
