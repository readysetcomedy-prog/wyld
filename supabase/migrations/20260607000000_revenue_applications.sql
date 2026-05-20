-- Two new modules:
--   revenue_expenses_enabled — owner tab for revenue and expense tracking.
--   applications_enabled    — owner tab for job postings; also adds a public
--                             "Careers" page on the gym's site.

alter table public.gym_modules
  add column if not exists revenue_expenses_enabled boolean not null default false,
  add column if not exists applications_enabled boolean not null default false;

-- Keep the owner guard in sync — only admins may flip these.
create or replace function public.gym_modules_owner_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if  new.bookings_enabled          is distinct from old.bookings_enabled
   or new.store_enabled             is distinct from old.store_enabled
   or new.news_enabled              is distinct from old.news_enabled
   or new.faq_enabled               is distinct from old.faq_enabled
   or new.analytics_enabled         is distinct from old.analytics_enabled
   or new.time_cards_enabled        is distinct from old.time_cards_enabled
   or new.door_enabled              is distinct from old.door_enabled
   or new.offerings_enabled         is distinct from old.offerings_enabled
   or new.employees_enabled         is distinct from old.employees_enabled
   or new.billing_enabled           is distinct from old.billing_enabled
   or new.marketing_enabled         is distinct from old.marketing_enabled
   or new.multi_location_enabled    is distinct from old.multi_location_enabled
   or new.max_locations             is distinct from old.max_locations
   or new.revenue_expenses_enabled  is distinct from old.revenue_expenses_enabled
   or new.applications_enabled      is distinct from old.applications_enabled
  then
    raise exception 'Only admins can change module access flags';
  end if;
  return new;
end $$;

-- Management-employee permissions for the new owner tabs.
alter table public.gym_employees
  add column if not exists perm_revenue_expenses boolean not null default false,
  add column if not exists perm_applications boolean not null default false;
