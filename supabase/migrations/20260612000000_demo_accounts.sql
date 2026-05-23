-- Demo accounts: bulk-create fake @demo.com auth users for testing, plus a
-- per-WyLD-employee permission gating the in-app quick-switcher.
--
-- We insert directly into auth.users (auto-confirmed) via SECURITY DEFINER
-- because the supabase-js client SDK has no admin create-user endpoint.

-- ---- 1. Permission column ----------------------------------------------
alter table public.gym_employees
  add column if not exists perm_demo boolean not null default false;

-- ---- 2. Authorization helper -------------------------------------------
create or replace function public.is_demo_authorized()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or exists (
      select 1
        from public.gym_employees e
        join public.gyms g on g.id = e.gym_id
       where g.slug = 'wyld'
         and e.user_id = auth.uid()
         and e.perm_demo = true
    );
$$;
grant execute on function public.is_demo_authorized() to authenticated;

-- ---- 3. Create one demo auth user (idempotent) --------------------------
-- All demo accounts share password 'demo'. Bypasses the supabase signup
-- minimum-length rule by inserting into auth.users directly.
create or replace function public.wyld_create_demo_account(
  p_email text,
  p_full_name text
) returns uuid
language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
  existing_id uuid;
  new_id uuid;
  hashed_pw text;
  norm_email text;
begin
  if not public.is_demo_authorized() then
    raise exception 'not authorized';
  end if;
  norm_email := lower(coalesce(p_email, ''));
  if position('@demo.com' in norm_email) = 0 then
    raise exception 'email must be a @demo.com address';
  end if;

  select id into existing_id from auth.users where lower(email) = norm_email limit 1;
  if existing_id is not null then
    return existing_id;
  end if;

  new_id := gen_random_uuid();
  hashed_pw := crypt('demo', gen_salt('bf'));

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id,
    'authenticated', 'authenticated',
    norm_email, hashed_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', coalesce(p_full_name, '')),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    created_at, updated_at, last_sign_in_at
  ) values (
    gen_random_uuid(), new_id::text, new_id,
    jsonb_build_object('sub', new_id::text, 'email', norm_email),
    'email', now(), now(), now()
  );

  -- handle_new_user trigger creates the profile row automatically.
  return new_id;
end $$;
grant execute on function public.wyld_create_demo_account(text, text) to authenticated;

-- ---- 4. Seed many at once (idempotent) ---------------------------------
create or replace function public.wyld_seed_demo_accounts(p_accounts jsonb)
returns int language plpgsql security definer
set search_path = public, auth, extensions
as $$
declare
  acc jsonb;
  total int := 0;
begin
  if not public.is_demo_authorized() then
    raise exception 'not authorized';
  end if;
  for acc in select * from jsonb_array_elements(p_accounts)
  loop
    perform public.wyld_create_demo_account(acc->>'email', acc->>'full_name');
    total := total + 1;
  end loop;
  return total;
end $$;
grant execute on function public.wyld_seed_demo_accounts(jsonb) to authenticated;

-- ---- 5. List demo accounts ---------------------------------------------
create or replace function public.wyld_list_demo_accounts()
returns table (
  id uuid,
  email text,
  full_name text,
  role public.user_role,
  gym_id uuid,
  gym_name text,
  created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select
    p.id, p.email, p.full_name, p.role, p.gym_id,
    g.name as gym_name, p.created_at
  from public.profiles p
  left join public.gyms g on g.id = p.gym_id
  where lower(p.email) like '%@demo.com'
    and public.is_demo_authorized()
  order by p.full_name nulls last, p.email;
$$;
grant execute on function public.wyld_list_demo_accounts() to authenticated;

-- ---- 6. Delete all demo accounts (admin only) --------------------------
create or replace function public.wyld_delete_all_demo_accounts()
returns int language plpgsql security definer
set search_path = public, auth
as $$
declare
  deleted int;
begin
  if not public.is_admin() then
    raise exception 'only admins can delete demo accounts';
  end if;
  delete from auth.users where lower(email) like '%@demo.com';
  get diagnostics deleted = row_count;
  return deleted;
end $$;
grant execute on function public.wyld_delete_all_demo_accounts() to authenticated;
