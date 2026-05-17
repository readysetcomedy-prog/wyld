-- Offerings get website-display fields + flexible pricing terms.
-- Packages bundle multiple offerings.

alter table public.gym_offerings
  add column if not exists published boolean not null default true,
  add column if not exists featured boolean not null default false,
  add column if not exists unit_label text,
  add column if not exists public_blurb text,
  -- [{ "label": "Pay 3 months", "price_cents": 13500 }]
  add column if not exists term_options jsonb;

-- Packages: a named bundle of offerings with its own price.
create table if not exists public.gym_packages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer,
  unit_label text,
  public_blurb text,
  published boolean not null default true,
  featured boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gym_packages_gym_idx on public.gym_packages(gym_id, display_order);

drop trigger if exists gym_packages_set_updated_at on public.gym_packages;
create trigger gym_packages_set_updated_at
  before update on public.gym_packages
  for each row execute function public.set_updated_at();

alter table public.gym_packages enable row level security;
create policy "gym_packages_public_read" on public.gym_packages
  for select to anon, authenticated using (true);
create policy "gym_packages_owner_write" on public.gym_packages
  for all to authenticated
  using (public.is_admin() or public.owns_gym(gym_id))
  with check (public.is_admin() or public.owns_gym(gym_id));

create table if not exists public.gym_package_offerings (
  package_id uuid not null references public.gym_packages(id) on delete cascade,
  offering_id uuid not null references public.gym_offerings(id) on delete cascade,
  primary key (package_id, offering_id)
);

alter table public.gym_package_offerings enable row level security;
create policy "gym_package_offerings_public_read" on public.gym_package_offerings
  for select to anon, authenticated using (true);
create policy "gym_package_offerings_owner_write" on public.gym_package_offerings
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.gym_packages p
      where p.id = gym_package_offerings.package_id and public.owns_gym(p.gym_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.gym_packages p
      where p.id = gym_package_offerings.package_id and public.owns_gym(p.gym_id)
    )
  );
