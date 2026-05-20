-- Employees: per-gym staff records with personal info, job info, credentials,
-- emergency contacts, location assignments, and per-tab permissions when the
-- role is management. Owner / admin manage the record; the employee
-- (matched by user_id or by their account email) can read and edit their
-- own personal info + emergency contacts.

-- ----------------------------------------------------------------------
-- Main table
create table if not exists public.gym_employees (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  full_name text not null,
  -- personal (employee-editable)
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  avatar_url text,
  -- job (owner-managed)
  position text,
  is_management boolean not null default false,
  hire_date date,
  terminate_date date,
  work_type text,
  direct_supervisor_id uuid references public.gym_employees(id) on delete set null,
  -- permissions — only meaningful when is_management is true
  perm_billing boolean not null default false,
  perm_website boolean not null default false,
  perm_messages boolean not null default false,
  perm_calendar boolean not null default false,
  perm_bookings boolean not null default false,
  perm_members boolean not null default false,
  perm_employees boolean not null default false,
  perm_store boolean not null default false,
  perm_marketing boolean not null default false,
  perm_analytics boolean not null default false,
  perm_door boolean not null default false,
  perm_offerings boolean not null default false,
  perm_settings boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists gym_employees_gym_email_uniq
  on public.gym_employees(gym_id, lower(email));
create index if not exists gym_employees_gym_idx on public.gym_employees(gym_id);
create index if not exists gym_employees_user_idx on public.gym_employees(user_id);

drop trigger if exists gym_employees_set_updated_at on public.gym_employees;
create trigger gym_employees_set_updated_at
  before update on public.gym_employees
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------
-- Credentials (unlimited per employee)
create table if not exists public.gym_employee_credentials (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.gym_employees(id) on delete cascade,
  label text not null,
  number text,
  expires_at date,
  display_order int not null default 0
);
create index if not exists gym_employee_credentials_emp_idx
  on public.gym_employee_credentials(employee_id, display_order);

-- ----------------------------------------------------------------------
-- Emergency contacts (unlimited per employee)
create table if not exists public.gym_employee_emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.gym_employees(id) on delete cascade,
  name text not null,
  relation text,
  phone text,
  email text,
  display_order int not null default 0
);
create index if not exists gym_employee_emergency_contacts_emp_idx
  on public.gym_employee_emergency_contacts(employee_id, display_order);

-- ----------------------------------------------------------------------
-- Location assignments (an employee can work at multiple gym locations)
create table if not exists public.gym_employee_locations (
  employee_id uuid not null references public.gym_employees(id) on delete cascade,
  location_id uuid not null references public.gym_locations(id) on delete cascade,
  primary key (employee_id, location_id)
);

-- ----------------------------------------------------------------------
-- RLS
alter table public.gym_employees enable row level security;
alter table public.gym_employee_credentials enable row level security;
alter table public.gym_employee_emergency_contacts enable row level security;
alter table public.gym_employee_locations enable row level security;

-- Does the current auth user match this employee record (by user_id or by
-- the email on their profile)?
create or replace function public.is_self_employee(e_user_id uuid, e_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(e_user_id = auth.uid(), false)
    or coalesce(
      lower(e_email) = lower((select email from public.profiles where id = auth.uid())),
      false
    );
$$;

-- gym_employees
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'gym_employees_read' and tablename = 'gym_employees') then
    create policy "gym_employees_read" on public.gym_employees
      for select to authenticated using (
        public.is_admin()
        or public.owns_gym(gym_id)
        or public.is_self_employee(user_id, email)
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_employees_write_owner' and tablename = 'gym_employees') then
    create policy "gym_employees_write_owner" on public.gym_employees
      for all to authenticated
      using (public.is_admin() or public.owns_gym(gym_id))
      with check (public.is_admin() or public.owns_gym(gym_id));
  end if;
end $$;

-- credentials — owner/admin full, employee read-only on own
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'gym_employee_credentials_read' and tablename = 'gym_employee_credentials') then
    create policy "gym_employee_credentials_read" on public.gym_employee_credentials
      for select to authenticated using (
        exists (
          select 1 from public.gym_employees e
          where e.id = employee_id and (
            public.is_admin() or public.owns_gym(e.gym_id) or public.is_self_employee(e.user_id, e.email)
          )
        )
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_employee_credentials_write' and tablename = 'gym_employee_credentials') then
    create policy "gym_employee_credentials_write" on public.gym_employee_credentials
      for all to authenticated
      using (
        exists (
          select 1 from public.gym_employees e
          where e.id = employee_id and (public.is_admin() or public.owns_gym(e.gym_id))
        )
      )
      with check (
        exists (
          select 1 from public.gym_employees e
          where e.id = employee_id and (public.is_admin() or public.owns_gym(e.gym_id))
        )
      );
  end if;
end $$;

-- emergency contacts — owner/admin full, employee can manage own
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'gym_employee_emergency_contacts_read' and tablename = 'gym_employee_emergency_contacts') then
    create policy "gym_employee_emergency_contacts_read" on public.gym_employee_emergency_contacts
      for select to authenticated using (
        exists (
          select 1 from public.gym_employees e
          where e.id = employee_id and (
            public.is_admin() or public.owns_gym(e.gym_id) or public.is_self_employee(e.user_id, e.email)
          )
        )
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_employee_emergency_contacts_write' and tablename = 'gym_employee_emergency_contacts') then
    create policy "gym_employee_emergency_contacts_write" on public.gym_employee_emergency_contacts
      for all to authenticated
      using (
        exists (
          select 1 from public.gym_employees e
          where e.id = employee_id and (
            public.is_admin() or public.owns_gym(e.gym_id) or public.is_self_employee(e.user_id, e.email)
          )
        )
      )
      with check (
        exists (
          select 1 from public.gym_employees e
          where e.id = employee_id and (
            public.is_admin() or public.owns_gym(e.gym_id) or public.is_self_employee(e.user_id, e.email)
          )
        )
      );
  end if;
end $$;

-- location assignments — owner/admin full, employee read-only on own
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'gym_employee_locations_read' and tablename = 'gym_employee_locations') then
    create policy "gym_employee_locations_read" on public.gym_employee_locations
      for select to authenticated using (
        exists (
          select 1 from public.gym_employees e
          where e.id = employee_id and (
            public.is_admin() or public.owns_gym(e.gym_id) or public.is_self_employee(e.user_id, e.email)
          )
        )
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_employee_locations_write' and tablename = 'gym_employee_locations') then
    create policy "gym_employee_locations_write" on public.gym_employee_locations
      for all to authenticated
      using (
        exists (
          select 1 from public.gym_employees e
          where e.id = employee_id and (public.is_admin() or public.owns_gym(e.gym_id))
        )
      )
      with check (
        exists (
          select 1 from public.gym_employees e
          where e.id = employee_id and (public.is_admin() or public.owns_gym(e.gym_id))
        )
      );
  end if;
end $$;

-- ----------------------------------------------------------------------
-- Self-update RPC for the personal fields on gym_employees. RLS only easily
-- restricts at row level; this function constrains exactly which columns
-- the employee can change on their own record.
create or replace function public.update_my_employee_profile(
  p_employee_id uuid,
  p_phone text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state text,
  p_zip text,
  p_avatar_url text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.gym_employees
  set phone = p_phone,
      address_line1 = p_address_line1,
      address_line2 = p_address_line2,
      city = p_city,
      state = p_state,
      zip = p_zip,
      avatar_url = coalesce(p_avatar_url, avatar_url),
      updated_at = now()
  where id = p_employee_id
    and public.is_self_employee(user_id, email);
end $$;

grant execute on function public.update_my_employee_profile(uuid, text, text, text, text, text, text, text)
  to authenticated;

-- ----------------------------------------------------------------------
-- Avatar storage bucket
insert into storage.buckets (id, name, public)
values ('employee-avatars', 'employee-avatars', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'employee_avatars_public_read'
      and schemaname = 'storage' and tablename = 'objects'
  ) then
    create policy "employee_avatars_public_read" on storage.objects
      for select to anon, authenticated using (bucket_id = 'employee-avatars');
  end if;
  if not exists (
    select 1 from pg_policies where policyname = 'employee_avatars_authenticated_write'
      and schemaname = 'storage' and tablename = 'objects'
  ) then
    create policy "employee_avatars_authenticated_write" on storage.objects
      for all to authenticated
      using (bucket_id = 'employee-avatars')
      with check (bucket_id = 'employee-avatars');
  end if;
end $$;
