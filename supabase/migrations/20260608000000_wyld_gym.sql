-- WyLD itself is modeled as a gym row so its staff fit the existing
-- gym_employees / gym_employee_* tables. Identified by slug 'wyld'.
-- handle_new_gym() will auto-create the matching gym_modules and gym_themes
-- rows.  multi_location_enabled isn't toggled here because the owner-guard
-- trigger forbids module flag changes outside an admin auth context — flip
-- it from the admin gym page if you want WyLD offices manageable.

do $$
declare
  wyld_id uuid;
begin
  if not exists (select 1 from public.gyms where slug = 'wyld') then
    insert into public.gyms (name, slug, join_code)
    values ('WyLD Inc', 'wyld', upper(substr(md5(random()::text), 1, 6)))
    returning id into wyld_id;
  else
    select id into wyld_id from public.gyms where slug = 'wyld';
  end if;

  if not exists (
    select 1 from public.gym_locations where gym_id = wyld_id
  ) then
    insert into public.gym_locations (gym_id, label, slug, is_primary, display_order)
    values (wyld_id, 'Headquarters', 'hq', true, 0);
  end if;
end $$;

-- Roles: gyms can define their own positions/titles. Employees in the
-- roster pick from these.
create table if not exists public.gym_roles (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists gym_roles_gym_name_uniq
  on public.gym_roles(gym_id, lower(name));
create index if not exists gym_roles_gym_idx
  on public.gym_roles(gym_id, display_order);

alter table public.gym_roles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'gym_roles_read' and tablename = 'gym_roles') then
    create policy "gym_roles_read" on public.gym_roles
      for select to authenticated using (
        public.is_admin()
        or public.owns_gym(gym_id)
        or exists (
          select 1 from public.gym_employees e
          where e.gym_id = gym_roles.gym_id
            and public.is_self_employee(e.user_id, e.email)
        )
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_roles_write_owner' and tablename = 'gym_roles') then
    create policy "gym_roles_write_owner" on public.gym_roles
      for all to authenticated
      using (public.is_admin() or public.owns_gym(gym_id))
      with check (public.is_admin() or public.owns_gym(gym_id));
  end if;
end $$;

