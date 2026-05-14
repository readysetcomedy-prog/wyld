-- Owner-toggleable page visibility flags. Default TRUE so existing gyms
-- keep all standard tabs visible.
alter table public.gym_modules
  add column if not exists about_enabled boolean not null default true,
  add column if not exists services_enabled boolean not null default true,
  add column if not exists contact_enabled boolean not null default true;
