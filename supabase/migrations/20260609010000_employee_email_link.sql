-- Whenever a gym_employees row is created (or its email changes), eagerly link
-- it to the matching profile if one exists. The other half of the picture —
-- backfilling at signup time — lives in the profiles_link_pending trigger
-- shipped with the jobs/applications migration.

create or replace function public.gym_employees_link_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null and new.email is not null then
    select id into new.user_id from public.profiles where lower(email) = lower(new.email) limit 1;
  end if;
  new.email := lower(new.email);
  return new;
end $$;

drop trigger if exists gym_employees_link_user_trigger on public.gym_employees;
create trigger gym_employees_link_user_trigger
  before insert or update of email on public.gym_employees
  for each row execute function public.gym_employees_link_user();
