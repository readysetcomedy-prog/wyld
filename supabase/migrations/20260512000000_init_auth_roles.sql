-- WyLD Pass: initial auth schema (roles, profiles, gyms)

create type public.user_role as enum ('admin', 'gym_owner', 'gym_employee', 'member');

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  state text,
  join_code char(6) not null unique,
  owner_id uuid,
  created_at timestamptz not null default now()
);

create index gyms_name_idx on public.gyms (lower(name));
create index gyms_location_idx on public.gyms (lower(city), lower(state));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'member',
  gym_id uuid references public.gyms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gyms
  add constraint gyms_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete set null;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth.users row is inserted.
-- Bootstrap: readysetcomedy@gmail.com is promoted to admin on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when lower(new.email) = 'readysetcomedy@gmail.com' then 'admin'::public.user_role
      else 'member'::public.user_role
    end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent users from changing their own role; only admins can promote/demote.
create or replace function public.prevent_role_self_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller_role public.user_role;
begin
  if new.role is distinct from old.role then
    select role into caller_role from public.profiles where id = auth.uid();
    if caller_role is distinct from 'admin' then
      raise exception 'role can only be changed by an admin';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- RLS
alter table public.profiles enable row level security;
alter table public.gyms enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- profiles: read own row, or any row if admin
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

-- profiles: update own row (role changes guarded by trigger above)
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- profiles: admin can update any row
create policy "profiles_admin_update_any"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- gyms: any authenticated user can read (for search)
create policy "gyms_authenticated_read"
  on public.gyms for select
  to authenticated
  using (true);

-- gyms: only admins can create/modify (gym owner claim flow handled later)
create policy "gyms_admin_write"
  on public.gyms for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- If the bootstrap admin email signed up before this migration ran, promote them.
update public.profiles
  set role = 'admin'
  where lower(email) = 'readysetcomedy@gmail.com';
