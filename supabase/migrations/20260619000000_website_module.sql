-- Website is now a real toggleable module instead of a hardcoded
-- always-on feature in the pricing model. Existing gyms default to
-- having a website (every customer already had one before this), and
-- the admin can turn it off per-gym from the gym modules page if a
-- gym doesn't want one.

alter table public.gym_modules
  add column if not exists website_enabled boolean not null default true;
