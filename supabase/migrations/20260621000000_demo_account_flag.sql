-- Generalize the demo-accounts list beyond the @demo.com email convention.
-- Demo accounts now have an explicit profiles.is_demo flag — any profile
-- (regardless of email domain) can be flipped on for demo use. Existing
-- @demo.com profiles stay listed via the OR in wyld_list_demo_accounts.
--
-- Seeds bob@beargym.com as a demo-accessible account so the founder can
-- jump into Bear Gym's owner experience from the switcher without having
-- to log out of admin.

alter table public.profiles
  add column if not exists is_demo boolean not null default false;

create index if not exists profiles_is_demo_idx on public.profiles(is_demo) where is_demo;

-- Seed: mark bob@beargym.com (the seeded Bear Gym owner) as a demo.
update public.profiles
   set is_demo = true
 where lower(email) = 'bob@beargym.com';

-- Updated list RPC includes both flagged profiles AND legacy @demo.com
-- accounts. Authorization rules unchanged (admin / perm_demo / a caller
-- who's themselves a demo account).
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
  where (p.is_demo or lower(p.email) like '%@demo.com')
    and (
      public.is_demo_authorized()
      or lower((select email from auth.users where id = auth.uid())) like '%@demo.com'
      or exists (
        select 1 from public.profiles me
        where me.id = auth.uid() and me.is_demo = true
      )
    )
  order by p.full_name nulls last, p.email;
$$;
grant execute on function public.wyld_list_demo_accounts() to authenticated;
