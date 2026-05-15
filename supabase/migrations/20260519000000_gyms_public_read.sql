-- The public gym site (/g/<slug>) is browsed by visitors who are not
-- signed in, so the layout fetches `gyms` with the anon key. The
-- original gyms RLS policy only allowed authenticated reads, which made
-- every public gym page render "Gym not found" for logged-out users
-- (and mobile visitors). The companion tables (gym_themes, gym_modules,
-- gym_site_settings, gym_pages) already permit anon select; mirror that
-- for gyms so the slug lookup actually succeeds.

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gyms'
      and policyname = 'gyms_authenticated_read'
  ) then
    drop policy "gyms_authenticated_read" on public.gyms;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gyms'
      and policyname = 'gyms_public_read'
  ) then
    create policy "gyms_public_read"
      on public.gyms for select
      to anon, authenticated
      using (true);
  end if;
end $$;
