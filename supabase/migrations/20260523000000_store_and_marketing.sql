-- Retail store products + marketing materials
-- ------------------------------------------------------------

create table if not exists public.gym_products (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer,
  currency text not null default 'USD',
  sku text,
  inventory_location text,
  image_url text,
  published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gym_products_gym_idx
  on public.gym_products(gym_id, display_order);

drop trigger if exists gym_products_set_updated_at on public.gym_products;
create trigger gym_products_set_updated_at
  before update on public.gym_products
  for each row execute function public.set_updated_at();

alter table public.gym_products enable row level security;

-- Public sees only published products. Owner/admin sees all of their gym's.
create policy "gym_products_public_read" on public.gym_products
  for select to anon, authenticated using (published = true);

create policy "gym_products_owner_read_all" on public.gym_products
  for select to authenticated using (
    public.is_admin() or public.owns_gym(gym_id)
  );

create policy "gym_products_owner_write" on public.gym_products
  for all to authenticated
  using (public.is_admin() or public.owns_gym(gym_id))
  with check (public.is_admin() or public.owns_gym(gym_id));

-- ------------------------------------------------------------
create table if not exists public.gym_marketing_assets (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  description text,
  image_url text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gym_marketing_assets_gym_idx
  on public.gym_marketing_assets(gym_id, display_order);

drop trigger if exists gym_marketing_assets_set_updated_at on public.gym_marketing_assets;
create trigger gym_marketing_assets_set_updated_at
  before update on public.gym_marketing_assets
  for each row execute function public.set_updated_at();

alter table public.gym_marketing_assets enable row level security;

-- Marketing assets are private to the owner (and admin). Not public.
create policy "gym_marketing_assets_owner_all" on public.gym_marketing_assets
  for all to authenticated
  using (public.is_admin() or public.owns_gym(gym_id))
  with check (public.is_admin() or public.owns_gym(gym_id));

-- ------------------------------------------------------------
-- Module flag for the Marketing dashboard tab. Default true so
-- existing gyms get it; admin can still flip off.
alter table public.gym_modules
  add column if not exists marketing_enabled boolean not null default true;

create or replace function public.gym_modules_owner_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if  new.bookings_enabled    is distinct from old.bookings_enabled
   or new.store_enabled       is distinct from old.store_enabled
   or new.news_enabled        is distinct from old.news_enabled
   or new.faq_enabled         is distinct from old.faq_enabled
   or new.analytics_enabled   is distinct from old.analytics_enabled
   or new.time_cards_enabled  is distinct from old.time_cards_enabled
   or new.door_enabled        is distinct from old.door_enabled
   or new.offerings_enabled   is distinct from old.offerings_enabled
   or new.employees_enabled   is distinct from old.employees_enabled
   or new.billing_enabled     is distinct from old.billing_enabled
   or new.marketing_enabled   is distinct from old.marketing_enabled
  then
    raise exception 'Only admins can change module access flags';
  end if;
  return new;
end $$;
