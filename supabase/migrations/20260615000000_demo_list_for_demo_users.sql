-- When the caller is already signed in as a demo account (email ending in
-- @demo.com), let them list demo accounts too so the quick-switcher works
-- mid-demo. is_demo_authorized() stays strict (admin / perm_demo only) for
-- create/seed/delete — only the read is opened up.

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
    and (
      public.is_demo_authorized()
      or lower((select email from auth.users where id = auth.uid())) like '%@demo.com'
    )
  order by p.full_name nulls last, p.email;
$$;
grant execute on function public.wyld_list_demo_accounts() to authenticated;
