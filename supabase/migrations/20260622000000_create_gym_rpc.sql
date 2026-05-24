-- Admin RPC for creating a new customer gym from /admin/gyms. Wraps:
--
--   1) Generating a unique join_code (the column is NOT NULL, even
--      though we don't surface joining-by-code in the UI right now).
--   2) Inserting the gym row, which fires handle_new_gym() to create
--      the matching gym_modules / gym_themes / gym_site_settings.
--   3) Optionally promoting a chosen profile to gym_owner and pointing
--      their profile.gym_id at the new gym, so they land on /owner
--      next time they sign in.
--
-- Owner is OPTIONAL — onboarding sometimes starts before the owner has
-- signed up for WyLD. The admin can come back and assign one later from
-- the gym's detail page.

create or replace function public.wyld_create_gym(
  p_name text,
  p_slug text,
  p_city text default null,
  p_state text default null,
  p_custom_domain text default null,
  p_owner_user_id uuid default null
)
returns table (id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_gym_id uuid;
  generated_code char(6);
  attempt int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create gyms';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Gym name is required';
  end if;
  if coalesce(trim(p_slug), '') = '' then
    raise exception 'Gym slug is required';
  end if;

  -- Generate a unique 6-char join_code. Retry a handful of times in the
  -- vanishingly rare case of a collision. After this many tries we fail
  -- loudly rather than silently picking a duplicate.
  loop
    generated_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.gyms where join_code = generated_code);
    attempt := attempt + 1;
    if attempt > 10 then
      raise exception 'Could not allocate a unique join_code after 10 attempts';
    end if;
  end loop;

  insert into public.gyms (name, slug, city, state, custom_domain, join_code, owner_id)
  values (
    trim(p_name),
    lower(trim(p_slug)),
    nullif(trim(p_city), ''),
    nullif(trim(p_state), ''),
    nullif(trim(p_custom_domain), ''),
    generated_code,
    p_owner_user_id
  )
  returning gyms.id into new_gym_id;

  -- Promote the chosen profile to gym_owner and point them at this gym
  -- so signing in lands them on /owner. We only flip role away from
  -- 'admin' callers (admins are platform-wide and shouldn't be demoted
  -- to a single gym).
  if p_owner_user_id is not null then
    update public.profiles
       set role = case when role = 'admin' then 'admin' else 'gym_owner' end,
           gym_id = new_gym_id
     where profiles.id = p_owner_user_id;
  end if;

  return query select new_gym_id, generated_code::text;
end;
$$;

grant execute on function public.wyld_create_gym(text, text, text, text, text, uuid)
  to authenticated;
