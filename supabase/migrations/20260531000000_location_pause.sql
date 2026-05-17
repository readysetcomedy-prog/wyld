-- Pause a location.
-- A paused location is hidden from the gym's public website (picker landing,
-- nav, contact page) but stays fully visible across the owner dashboard.
-- Lets owners temporarily close a location — or stay within a paid location
-- limit — without deleting it and losing its content.
alter table public.gym_locations
  add column if not exists is_paused boolean not null default false;
