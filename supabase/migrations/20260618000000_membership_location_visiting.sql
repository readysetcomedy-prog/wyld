-- Per-location membership + cross-location visiting rules.

-- 1) Memberships now record which of the gym's locations the member
-- joined at. Nullable for backwards compatibility — existing memberships
-- pre-date this column. Setting it enables location-level reporting
-- (revenue, headcount, retention by location) and lets a gym choose
-- whether members at one location can use another.
alter table public.gym_memberships
  add column if not exists location_id uuid references public.gym_locations(id) on delete set null;

create index if not exists gym_memberships_location_idx
  on public.gym_memberships(location_id);

-- 2) Each location can opt to accept members coming from the gym's
-- other locations, with an optional per-visit fee.
-- - allow_visiting_members: when true, members at any of this gym's
--   other locations can use this one (i.e. show up here / use bookings).
-- - visiting_fee_cents: optional surcharge per visit. 0 = free for
--   visiting members.
alter table public.gym_locations
  add column if not exists allow_visiting_members boolean not null default false,
  add column if not exists visiting_fee_cents integer not null default 0
    check (visiting_fee_cents >= 0);
