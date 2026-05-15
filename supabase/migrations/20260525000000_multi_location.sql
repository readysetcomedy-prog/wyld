-- Multi-location feature.
-- Admin grants per-gym via multi_location_enabled (and a max_locations number).
-- Owner manages locations (each with its own slug); per-location overrides
-- of theme, pages, events, products, news live on the same tables via a
-- nullable location_id column. NULL = default for the gym (shown when a
-- location has no override of its own).

-- ------------------------------------------------------------
-- Module flags
alter table public.gym_modules
  add column if not exists multi_location_enabled boolean not null default false,
  add column if not exists max_locations integer not null default 1;

create or replace function public.gym_modules_owner_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if  new.bookings_enabled        is distinct from old.bookings_enabled
   or new.store_enabled           is distinct from old.store_enabled
   or new.news_enabled            is distinct from old.news_enabled
   or new.faq_enabled             is distinct from old.faq_enabled
   or new.analytics_enabled       is distinct from old.analytics_enabled
   or new.time_cards_enabled      is distinct from old.time_cards_enabled
   or new.door_enabled            is distinct from old.door_enabled
   or new.offerings_enabled       is distinct from old.offerings_enabled
   or new.employees_enabled       is distinct from old.employees_enabled
   or new.billing_enabled         is distinct from old.billing_enabled
   or new.marketing_enabled       is distinct from old.marketing_enabled
   or new.multi_location_enabled  is distinct from old.multi_location_enabled
   or new.max_locations           is distinct from old.max_locations
  then
    raise exception 'Only admins can change module access flags';
  end if;
  return new;
end $$;

-- ------------------------------------------------------------
-- gym_locations: add slug + is_primary
alter table public.gym_locations
  add column if not exists slug text,
  add column if not exists is_primary boolean not null default false;

-- One slug per gym (case-insensitive)
create unique index if not exists gym_locations_gym_slug_uniq
  on public.gym_locations (gym_id, lower(slug)) where slug is not null;

-- Exactly one primary per gym (partial uniqueness)
create unique index if not exists gym_locations_gym_primary_uniq
  on public.gym_locations (gym_id) where is_primary = true;

-- ------------------------------------------------------------
-- Per-location override columns. NULL means "default for the gym"
-- (the existing single-location content). When a location has a row
-- with its own location_id, that row wins; otherwise the public site
-- falls back to the gym default.

-- gym_themes: was PK(gym_id). Need surrogate id PK so multiple rows
-- per gym can coexist.
alter table public.gym_themes
  add column if not exists location_id uuid references public.gym_locations(id) on delete cascade;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='gym_themes' and constraint_name='gym_themes_pkey'
  ) then
    -- Find the existing PK column(s); only drop if it's still PK(gym_id).
    if exists (
      select 1
      from information_schema.key_column_usage
      where table_schema='public' and table_name='gym_themes'
        and constraint_name='gym_themes_pkey'
        and column_name='gym_id'
    ) then
      alter table public.gym_themes drop constraint gym_themes_pkey;
    end if;
  end if;
end $$;

alter table public.gym_themes
  add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='gym_themes' and constraint_name='gym_themes_pkey'
  ) then
    alter table public.gym_themes add constraint gym_themes_pkey primary key (id);
  end if;
end $$;

-- One default (location_id IS NULL) row per gym
create unique index if not exists gym_themes_default_uniq
  on public.gym_themes (gym_id) where location_id is null;
-- One row per (gym, location)
create unique index if not exists gym_themes_location_uniq
  on public.gym_themes (gym_id, location_id) where location_id is not null;

-- gym_pages: already has surrogate id PK. Replace (gym_id,page_key) unique
alter table public.gym_pages
  add column if not exists location_id uuid references public.gym_locations(id) on delete cascade;

alter table public.gym_pages
  drop constraint if exists gym_pages_gym_id_page_key_key;
drop index if exists gym_pages_gym_id_page_key_key;

create unique index if not exists gym_pages_default_uniq
  on public.gym_pages (gym_id, page_key) where location_id is null;
create unique index if not exists gym_pages_location_uniq
  on public.gym_pages (gym_id, location_id, page_key) where location_id is not null;

-- gym_products: shared (NULL) + per-location
alter table public.gym_products
  add column if not exists location_id uuid references public.gym_locations(id) on delete cascade;
create index if not exists gym_products_location_idx
  on public.gym_products(gym_id, location_id);

-- gym_events: shared (NULL) + per-location
alter table public.gym_events
  add column if not exists location_id uuid references public.gym_locations(id) on delete cascade;
create index if not exists gym_events_location_idx
  on public.gym_events(gym_id, location_id);

-- gym_news_posts: same model
do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='gym_news_posts') then
    execute 'alter table public.gym_news_posts add column if not exists location_id uuid references public.gym_locations(id) on delete cascade';
    execute 'create index if not exists gym_news_posts_location_idx on public.gym_news_posts(gym_id, location_id)';
  end if;
end $$;

-- ------------------------------------------------------------
-- Mark exactly one existing location per gym as primary (the first one).
-- And give it a slug derived from label if missing.
do $$
declare
  r record;
begin
  for r in
    select gym_id, min(created_at) as earliest
    from public.gym_locations
    where not exists (
      select 1 from public.gym_locations l2
      where l2.gym_id = gym_locations.gym_id and l2.is_primary = true
    )
    group by gym_id
  loop
    update public.gym_locations
       set is_primary = true
     where gym_id = r.gym_id and created_at = r.earliest;
  end loop;
end $$;

-- Backfill slugs from labels (lowercased, alpha-num + dashes). Only if null.
update public.gym_locations
   set slug = lower(regexp_replace(coalesce(label, 'location-' || substr(id::text, 1, 8)), '[^a-zA-Z0-9]+', '-', 'g'))
 where slug is null;
