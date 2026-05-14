-- Let SQL/superuser actions change profile roles. The original trigger
-- raised whenever auth.uid() didn't resolve to an admin, which also blocked
-- legitimate server-side updates (migrations, scripts run by the service
-- role) because auth.uid() is null in those contexts.

create or replace function public.prevent_role_self_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller_role public.user_role;
begin
  if new.role is distinct from old.role then
    -- Server-side updates (no authenticated user) bypass.
    if auth.uid() is null then
      return new;
    end if;
    select role into caller_role from public.profiles where id = auth.uid();
    if caller_role is distinct from 'admin' then
      raise exception 'role can only be changed by an admin';
    end if;
  end if;
  return new;
end $$;
