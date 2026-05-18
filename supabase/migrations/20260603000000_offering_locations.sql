-- Offerings can be location-specific so a gym can price the same thing
-- differently per location. location_id NULL = shared across all locations
-- (the existing behaviour); a non-null location_id scopes the offering to
-- that one location. Mirrors the per-location model used by gym_events.
alter table public.gym_offerings
  add column if not exists location_id uuid
    references public.gym_locations(id) on delete cascade;

create index if not exists gym_offerings_location_idx
  on public.gym_offerings(gym_id, location_id);
