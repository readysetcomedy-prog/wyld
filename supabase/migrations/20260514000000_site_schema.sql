-- Multi-tenant gym site schema:
--   * extend gyms with slug + custom_domain
--   * gym_modules: per-gym feature toggles (drive both dashboard tabs and
--     public-site pages)
--   * gym_themes: owner-controllable branding (logo + 2 colors)
--   * gym_pages: page content as JSONB (one row per (gym_id, page_key))
--   * gym_site_settings: contact, hours, address, social, meta
--   * gym_memberships: member <-> gym join so a member can belong to many gyms
--   * storage bucket 'gym-assets' for uploaded images
--
-- All site-rendering tables are world-readable so the public marketing
-- site can fetch with the anon key. Writes are restricted to that gym's
-- owner or to admins. Module toggles are admin-only.

alter table public.gyms
  add column if not exists slug text unique,
  add column if not exists custom_domain text unique;

-- gym_modules
create table if not exists public.gym_modules (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  calendar_enabled boolean not null default false,
  store_enabled boolean not null default false,
  bookings_enabled boolean not null default false,
  analytics_enabled boolean not null default true,
  time_cards_enabled boolean not null default false,
  door_enabled boolean not null default true,
  offerings_enabled boolean not null default true,
  employees_enabled boolean not null default true,
  billing_enabled boolean not null default true,
  news_enabled boolean not null default false,
  faq_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists gym_modules_set_updated_at on public.gym_modules;
create trigger gym_modules_set_updated_at
  before update on public.gym_modules
  for each row execute function public.set_updated_at();

-- gym_themes
create table if not exists public.gym_themes (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  primary_color text not null default '#0F172A',
  accent_color text not null default '#14B8A6',
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists gym_themes_set_updated_at on public.gym_themes;
create trigger gym_themes_set_updated_at
  before update on public.gym_themes
  for each row execute function public.set_updated_at();

-- gym_pages
create table if not exists public.gym_pages (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  page_key text not null,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (gym_id, page_key)
);
drop trigger if exists gym_pages_set_updated_at on public.gym_pages;
create trigger gym_pages_set_updated_at
  before update on public.gym_pages
  for each row execute function public.set_updated_at();

-- gym_site_settings
create table if not exists public.gym_site_settings (
  gym_id uuid primary key references public.gyms(id) on delete cascade,
  contact_email text,
  contact_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  hours jsonb not null default '{}'::jsonb,
  social_instagram text,
  social_facebook text,
  social_x text,
  social_tiktok text,
  meta_description text,
  updated_at timestamptz not null default now()
);
drop trigger if exists gym_site_settings_set_updated_at on public.gym_site_settings;
create trigger gym_site_settings_set_updated_at
  before update on public.gym_site_settings
  for each row execute function public.set_updated_at();

-- gym_memberships
create table if not exists public.gym_memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, gym_id)
);
drop trigger if exists gym_memberships_set_updated_at on public.gym_memberships;
create trigger gym_memberships_set_updated_at
  before update on public.gym_memberships
  for each row execute function public.set_updated_at();

-- helper: is the auth user the owner of this gym?
create or replace function public.is_owner_of(p_gym_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and gym_id = p_gym_id
      and role = 'gym_owner'
  )
$$;

-- auto-create site rows on new gym
create or replace function public.handle_new_gym()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.gym_modules (gym_id) values (new.id) on conflict do nothing;
  insert into public.gym_themes (gym_id) values (new.id) on conflict do nothing;
  insert into public.gym_site_settings (gym_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_gym_created on public.gyms;
create trigger on_gym_created
  after insert on public.gyms
  for each row execute function public.handle_new_gym();

-- backfill for existing gyms (Bear Gym)
insert into public.gym_modules (gym_id)
  select id from public.gyms where id not in (select gym_id from public.gym_modules);
insert into public.gym_themes (gym_id)
  select id from public.gyms where id not in (select gym_id from public.gym_themes);
insert into public.gym_site_settings (gym_id)
  select id from public.gyms where id not in (select gym_id from public.gym_site_settings);
update public.gyms set slug = 'bear-gym' where lower(name) = 'bear gym' and slug is null;

-- RLS
alter table public.gym_modules enable row level security;
alter table public.gym_themes enable row level security;
alter table public.gym_pages enable row level security;
alter table public.gym_site_settings enable row level security;
alter table public.gym_memberships enable row level security;

do $$
begin
  -- gym_modules
  if not exists (select 1 from pg_policies where policyname = 'gym_modules_public_read' and tablename = 'gym_modules') then
    create policy "gym_modules_public_read" on public.gym_modules
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_modules_admin_write' and tablename = 'gym_modules') then
    create policy "gym_modules_admin_write" on public.gym_modules
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  -- gym_themes
  if not exists (select 1 from pg_policies where policyname = 'gym_themes_public_read' and tablename = 'gym_themes') then
    create policy "gym_themes_public_read" on public.gym_themes
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_themes_owner_update' and tablename = 'gym_themes') then
    create policy "gym_themes_owner_update" on public.gym_themes
      for update to authenticated
      using (public.is_owner_of(gym_id) or public.is_admin())
      with check (public.is_owner_of(gym_id) or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_themes_admin_write' and tablename = 'gym_themes') then
    create policy "gym_themes_admin_write" on public.gym_themes
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  -- gym_pages
  if not exists (select 1 from pg_policies where policyname = 'gym_pages_public_read' and tablename = 'gym_pages') then
    create policy "gym_pages_public_read" on public.gym_pages
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_pages_owner_write' and tablename = 'gym_pages') then
    create policy "gym_pages_owner_write" on public.gym_pages
      for all to authenticated
      using (public.is_owner_of(gym_id) or public.is_admin())
      with check (public.is_owner_of(gym_id) or public.is_admin());
  end if;

  -- gym_site_settings
  if not exists (select 1 from pg_policies where policyname = 'gym_site_settings_public_read' and tablename = 'gym_site_settings') then
    create policy "gym_site_settings_public_read" on public.gym_site_settings
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_site_settings_owner_update' and tablename = 'gym_site_settings') then
    create policy "gym_site_settings_owner_update" on public.gym_site_settings
      for update to authenticated
      using (public.is_owner_of(gym_id) or public.is_admin())
      with check (public.is_owner_of(gym_id) or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_site_settings_admin_write' and tablename = 'gym_site_settings') then
    create policy "gym_site_settings_admin_write" on public.gym_site_settings
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  -- gym_memberships
  if not exists (select 1 from pg_policies where policyname = 'gym_memberships_read' and tablename = 'gym_memberships') then
    create policy "gym_memberships_read" on public.gym_memberships
      for select to authenticated
      using (auth.uid() = member_id or public.is_admin() or public.is_owner_of(gym_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_memberships_member_insert' and tablename = 'gym_memberships') then
    create policy "gym_memberships_member_insert" on public.gym_memberships
      for insert to authenticated
      with check (auth.uid() = member_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_memberships_admin_write' and tablename = 'gym_memberships') then
    create policy "gym_memberships_admin_write" on public.gym_memberships
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- Storage bucket for gym-uploaded images
insert into storage.buckets (id, name, public)
  values ('gym-assets', 'gym-assets', true)
  on conflict do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'gym-assets public read' and tablename = 'objects' and schemaname = 'storage') then
    create policy "gym-assets public read" on storage.objects
      for select to anon, authenticated using (bucket_id = 'gym-assets');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym-assets owner insert' and tablename = 'objects' and schemaname = 'storage') then
    create policy "gym-assets owner insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'gym-assets'
        and (
          public.is_admin()
          or (storage.foldername(name))[1] = (select gym_id::text from public.profiles where id = auth.uid())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym-assets owner update' and tablename = 'objects' and schemaname = 'storage') then
    create policy "gym-assets owner update" on storage.objects
      for update to authenticated
      using (
        bucket_id = 'gym-assets'
        and (
          public.is_admin()
          or (storage.foldername(name))[1] = (select gym_id::text from public.profiles where id = auth.uid())
        )
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym-assets owner delete' and tablename = 'objects' and schemaname = 'storage') then
    create policy "gym-assets owner delete" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'gym-assets'
        and (
          public.is_admin()
          or (storage.foldername(name))[1] = (select gym_id::text from public.profiles where id = auth.uid())
        )
      );
  end if;
end $$;
