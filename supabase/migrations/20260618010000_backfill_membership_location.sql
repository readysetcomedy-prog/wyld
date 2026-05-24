-- One-shot backfill for memberships that existed before the location_id
-- column landed. For gyms with exactly one (non-paused) location there's
-- only one valid value to set; for multi-location gyms we leave it null
-- (the owner has to decide which location each historical member came
-- from). New memberships always set location_id explicitly via the join
-- flow.

with single_loc_gym as (
  select gym_id, (array_agg(id))[1] as loc_id
    from public.gym_locations
   where is_paused = false
   group by gym_id
   having count(*) = 1
)
update public.gym_memberships m
   set location_id = s.loc_id
  from single_loc_gym s
 where m.gym_id = s.gym_id
   and m.location_id is null;
