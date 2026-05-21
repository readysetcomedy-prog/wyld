-- Hiring pipeline: job postings + applications.
-- Postings are visible publicly when status='open' (so the gym's Careers page
-- and the in-app member Jobs tab can both list them).
-- Applications can be in-app (logged-in, user_id set, auto-creates a
-- gym_memberships row) or cold from the public Careers page (no user_id —
-- the profile-backfill trigger links them once the applicant signs up).

create table if not exists public.gym_job_postings (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null,
  role_id uuid references public.gym_roles(id) on delete set null,
  location_id uuid references public.gym_locations(id) on delete set null,
  description text,
  employment_type text,
  compensation text,
  status text not null default 'open',
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('open','closed','draft'))
);
create index if not exists gym_job_postings_gym_idx
  on public.gym_job_postings(gym_id, status, display_order);

alter table public.gym_job_postings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='gym_job_postings_read_public' and tablename='gym_job_postings') then
    create policy "gym_job_postings_read_public" on public.gym_job_postings
      for select using (status = 'open');
  end if;
  if not exists (select 1 from pg_policies where policyname='gym_job_postings_read_owner' and tablename='gym_job_postings') then
    create policy "gym_job_postings_read_owner" on public.gym_job_postings
      for select to authenticated using (
        public.is_admin() or public.owns_gym(gym_id)
        or exists (
          select 1 from public.gym_employees e
          where e.gym_id = gym_job_postings.gym_id
            and public.is_self_employee(e.user_id, e.email)
        )
      );
  if not exists (select 1 from pg_policies where policyname='gym_job_postings_write' and tablename='gym_job_postings') then
    create policy "gym_job_postings_write" on public.gym_job_postings
      for all to authenticated
      using (public.is_admin() or public.owns_gym(gym_id))
      with check (public.is_admin() or public.owns_gym(gym_id));
  end if;
  end if;
end $$;

create table if not exists public.gym_job_applications (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references public.gym_job_postings(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  cover_note text,
  status text not null default 'new',
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('new','reviewing','hired','rejected','withdrawn'))
);
create index if not exists gym_job_applications_posting_idx
  on public.gym_job_applications(posting_id);
create index if not exists gym_job_applications_gym_idx
  on public.gym_job_applications(gym_id, status, applied_at desc);
create index if not exists gym_job_applications_user_idx
  on public.gym_job_applications(user_id);
create index if not exists gym_job_applications_email_idx
  on public.gym_job_applications(lower(email));

alter table public.gym_job_applications enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='gym_job_applications_read_self' and tablename='gym_job_applications') then
    create policy "gym_job_applications_read_self" on public.gym_job_applications
      for select to authenticated using (
        user_id = auth.uid()
        or public.is_admin()
        or public.owns_gym(gym_id)
        or exists (
          select 1 from public.gym_employees e
          where e.gym_id = gym_job_applications.gym_id
            and public.is_self_employee(e.user_id, e.email)
            and e.perm_applications = true
        )
      );
  end if;
  if not exists (select 1 from pg_policies where policyname='gym_job_applications_insert_public' and tablename='gym_job_applications') then
    -- Anyone (anon or auth) may submit; the trigger keeps the row sane.
    create policy "gym_job_applications_insert_public" on public.gym_job_applications
      for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='gym_job_applications_write_owner' and tablename='gym_job_applications') then
    create policy "gym_job_applications_write_owner" on public.gym_job_applications
      for update to authenticated
      using (public.is_admin() or public.owns_gym(gym_id))
      with check (public.is_admin() or public.owns_gym(gym_id));
  end if;
  if not exists (select 1 from pg_policies where policyname='gym_job_applications_delete_owner' and tablename='gym_job_applications') then
    create policy "gym_job_applications_delete_owner" on public.gym_job_applications
      for delete to authenticated
      using (public.is_admin() or public.owns_gym(gym_id));
  end if;
end $$;

-- Sanity guard on insert: gym_id must match posting.gym_id; user_id (if set)
-- must match auth.uid() for in-app submissions.
create or replace function public.gym_job_applications_validate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  posting_gym uuid;
begin
  select gym_id into posting_gym from public.gym_job_postings where id = new.posting_id;
  if posting_gym is null then
    raise exception 'Posting not found';
  end if;
  new.gym_id := posting_gym;
  -- Anyone but the gym owner / admin can only set user_id to their own
  -- auth.uid() (or leave it null for anon cold submissions). This blocks
  -- impersonation from an anon insert.
  if not public.is_admin() and not public.owns_gym(new.gym_id) then
    new.user_id := auth.uid();
  end if;
  new.email := lower(new.email);
  return new;
end $$;

drop trigger if exists gym_job_applications_validate_trigger on public.gym_job_applications;
create trigger gym_job_applications_validate_trigger
  before insert or update on public.gym_job_applications
  for each row execute function public.gym_job_applications_validate();

-- Backfill trigger: when a profile is created or its email changes, link any
-- existing gym_employees and gym_job_applications rows that match the email.
-- Lets manual-hire-by-email and cold Careers applications "find" the user
-- once they sign up.
create or replace function public.profiles_link_pending()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.gym_employees
     set user_id = new.id
   where user_id is null
     and lower(email) = lower(new.email);
  update public.gym_job_applications
     set user_id = new.id
   where user_id is null
     and lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists profiles_link_pending_insert on public.profiles;
create trigger profiles_link_pending_insert
  after insert on public.profiles
  for each row execute function public.profiles_link_pending();

drop trigger if exists profiles_link_pending_update on public.profiles;
create trigger profiles_link_pending_update
  after update of email on public.profiles
  for each row execute function public.profiles_link_pending();
