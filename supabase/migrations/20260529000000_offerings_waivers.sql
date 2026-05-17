-- Offerings, waivers, and waiver signatures.

-- Offerings (memberships, passes, packages — the gym's sellable plans).
create table if not exists public.gym_offerings (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gym_offerings_gym_idx on public.gym_offerings(gym_id, display_order);

drop trigger if exists gym_offerings_set_updated_at on public.gym_offerings;
create trigger gym_offerings_set_updated_at
  before update on public.gym_offerings
  for each row execute function public.set_updated_at();

alter table public.gym_offerings enable row level security;
create policy "gym_offerings_public_read" on public.gym_offerings
  for select to anon, authenticated using (true);
create policy "gym_offerings_owner_write" on public.gym_offerings
  for all to authenticated
  using (public.is_admin() or public.owns_gym(gym_id))
  with check (public.is_admin() or public.owns_gym(gym_id));

-- Waivers (rich-text legal documents).
create table if not exists public.gym_waivers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null,
  content text not null default '',
  applies_to_all boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gym_waivers_gym_idx on public.gym_waivers(gym_id);

drop trigger if exists gym_waivers_set_updated_at on public.gym_waivers;
create trigger gym_waivers_set_updated_at
  before update on public.gym_waivers
  for each row execute function public.set_updated_at();

alter table public.gym_waivers enable row level security;
-- Waivers are shown to anyone about to join, so readable broadly.
create policy "gym_waivers_public_read" on public.gym_waivers
  for select to anon, authenticated using (true);
create policy "gym_waivers_owner_write" on public.gym_waivers
  for all to authenticated
  using (public.is_admin() or public.owns_gym(gym_id))
  with check (public.is_admin() or public.owns_gym(gym_id));

-- Waiver ↔ offering attachments (used when applies_to_all is false).
create table if not exists public.gym_waiver_offerings (
  waiver_id uuid not null references public.gym_waivers(id) on delete cascade,
  offering_id uuid not null references public.gym_offerings(id) on delete cascade,
  primary key (waiver_id, offering_id)
);

alter table public.gym_waiver_offerings enable row level security;
create policy "gym_waiver_offerings_public_read" on public.gym_waiver_offerings
  for select to anon, authenticated using (true);
create policy "gym_waiver_offerings_owner_write" on public.gym_waiver_offerings
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.gym_waivers w
      where w.id = gym_waiver_offerings.waiver_id and public.owns_gym(w.gym_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.gym_waivers w
      where w.id = gym_waiver_offerings.waiver_id and public.owns_gym(w.gym_id)
    )
  );

-- Signed waivers, saved against the signing member.
create table if not exists public.gym_waiver_signatures (
  id uuid primary key default gen_random_uuid(),
  waiver_id uuid not null references public.gym_waivers(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete set null,
  participant_name text not null,
  date_of_birth text,
  phone text,
  email text,
  emergency_contact text,
  emergency_contact_phone text,
  typed_signature text not null,
  signature_data_url text,
  unauthorized_initials text,
  waiver_title text,
  waiver_snapshot text,
  signed_at timestamptz not null default now()
);
create index if not exists gym_waiver_signatures_gym_idx
  on public.gym_waiver_signatures(gym_id, member_id);
create index if not exists gym_waiver_signatures_waiver_idx
  on public.gym_waiver_signatures(waiver_id);

alter table public.gym_waiver_signatures enable row level security;
-- A signature is readable by its member, the gym owner, and admin.
create policy "gym_waiver_signatures_read" on public.gym_waiver_signatures
  for select to authenticated using (
    public.is_admin()
    or member_id = auth.uid()
    or public.owns_gym(gym_id)
  );
-- A member records their own signature.
create policy "gym_waiver_signatures_member_insert" on public.gym_waiver_signatures
  for insert to authenticated with check (member_id = auth.uid());
