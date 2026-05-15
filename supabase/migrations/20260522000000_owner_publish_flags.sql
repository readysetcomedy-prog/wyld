-- Two-layer module model:
--   <feature>_enabled   - admin grants the gym access to the module
--   <feature>_visible   - owner chooses whether to publish the module's
--                         public website tab (only meaningful when granted)
--
-- Public site shows the tab iff (admin granted AND owner published).
-- Owner sidebar shows dashboard tab iff admin granted.
-- Owner can flip the *_visible flags. Admin can flip everything.

alter table public.gym_modules
  add column if not exists news_visible boolean not null default true,
  add column if not exists faq_visible boolean not null default true,
  add column if not exists store_visible boolean not null default true;

-- Owners must not change admin-controlled module-access flags via the API.
create or replace function public.gym_modules_owner_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    return new;
  end if;
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
  then
    raise exception 'Only admins can change module access flags';
  end if;
  return new;
end $$;

drop trigger if exists gym_modules_owner_guard on public.gym_modules;
create trigger gym_modules_owner_guard
  before update on public.gym_modules
  for each row execute function public.gym_modules_owner_guard();
