-- Messages, calendar/events, multi-location contacts
-- ------------------------------------------------------------

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Helper: is the current user the owner of a gym?
create or replace function public.owns_gym(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gyms where id = g and owner_id = auth.uid()
  );
$$;

-- Helper: is the current user an active member of a gym?
create or replace function public.is_member_of(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gym_memberships
    where gym_id = g and member_id = auth.uid() and status = 'active'
  );
$$;

-- ------------------------------------------------------------
-- Multi-location contact
-- ------------------------------------------------------------
create table if not exists public.gym_locations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  label text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gym_locations_gym_idx on public.gym_locations(gym_id);

create table if not exists public.gym_location_contacts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.gym_locations(id) on delete cascade,
  kind text not null check (kind in ('email','phone')),
  value text not null,
  label text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gym_location_contacts_loc_idx on public.gym_location_contacts(location_id);

alter table public.gym_locations enable row level security;
alter table public.gym_location_contacts enable row level security;

create policy "gym_locations_public_read" on public.gym_locations
  for select to anon, authenticated using (true);
create policy "gym_locations_owner_write" on public.gym_locations
  for all to authenticated
  using (public.is_admin() or public.owns_gym(gym_id))
  with check (public.is_admin() or public.owns_gym(gym_id));

create policy "gym_location_contacts_public_read" on public.gym_location_contacts
  for select to anon, authenticated using (true);
create policy "gym_location_contacts_owner_write" on public.gym_location_contacts
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.gym_locations l
      where l.id = gym_location_contacts.location_id
        and public.owns_gym(l.gym_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.gym_locations l
      where l.id = gym_location_contacts.location_id
        and public.owns_gym(l.gym_id)
    )
  );

-- ------------------------------------------------------------
-- Messaging
-- ------------------------------------------------------------
create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('member_gym','admin_user','contact_form')),
  gym_id uuid references public.gyms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  anon_name text,
  anon_email text,
  subject text,
  last_message_at timestamptz not null default now(),
  user_last_read_at timestamptz,
  gym_last_read_at timestamptz,
  admin_last_read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists message_threads_gym_idx on public.message_threads(gym_id);
create index if not exists message_threads_user_idx on public.message_threads(user_id);
create index if not exists message_threads_kind_idx on public.message_threads(kind);

-- A user has at most one member_gym thread per (user,gym); enforce.
create unique index if not exists message_threads_unique_member_gym
  on public.message_threads(user_id, gym_id)
  where kind = 'member_gym';

-- A user has at most one admin_user thread.
create unique index if not exists message_threads_unique_admin_user
  on public.message_threads(user_id)
  where kind = 'admin_user';

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_user_id uuid references public.profiles(id) on delete set null,
  sender_is_gym boolean not null default false,
  sender_is_admin boolean not null default false,
  sender_is_anon boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages(thread_id, created_at);

-- Bump thread.last_message_at when a message is inserted.
create or replace function public.bump_thread_last_message()
returns trigger language plpgsql as $$
begin
  update public.message_threads
    set last_message_at = new.created_at
    where id = new.thread_id;
  return new;
end $$;

drop trigger if exists messages_bump_thread on public.messages;
create trigger messages_bump_thread
  after insert on public.messages
  for each row execute function public.bump_thread_last_message();

alter table public.message_threads enable row level security;
alter table public.messages enable row level security;

-- Thread visibility:
--   member_gym  -> the user, the gym owner, admin
--   admin_user  -> the user, admin
--   contact_form -> the gym owner (and admin)
create policy "message_threads_read" on public.message_threads
  for select to authenticated using (
    public.is_admin()
    or (kind = 'member_gym' and (user_id = auth.uid() or public.owns_gym(gym_id)))
    or (kind = 'admin_user' and user_id = auth.uid())
    or (kind = 'contact_form' and public.owns_gym(gym_id))
  );

-- Insert threads:
--   member_gym  -> any signed-in user can open a thread with any gym (as themselves)
--                  or gym owner can start one with a member of their gym
--   admin_user  -> the user can start it (with_admin); admin can also start it
--   contact_form -> ANY (incl. anon) — public contact form
create policy "message_threads_insert_authenticated" on public.message_threads
  for insert to authenticated with check (
    (kind = 'member_gym' and (
      user_id = auth.uid()
      or (public.owns_gym(gym_id) and user_id is not null and public.is_member_of(gym_id))
    ))
    or (kind = 'admin_user' and (user_id = auth.uid() or public.is_admin()))
    or (kind = 'contact_form' and gym_id is not null)
  );

create policy "message_threads_insert_anon_contact" on public.message_threads
  for insert to anon with check (
    kind = 'contact_form'
    and gym_id is not null
    and user_id is null
    and anon_name is not null
    and anon_email is not null
  );

-- Update threads (for *_last_read_at bumps).
create policy "message_threads_update_participants" on public.message_threads
  for update to authenticated using (
    public.is_admin()
    or (kind = 'member_gym' and (user_id = auth.uid() or public.owns_gym(gym_id)))
    or (kind = 'admin_user' and (user_id = auth.uid() or public.is_admin()))
    or (kind = 'contact_form' and public.owns_gym(gym_id))
  ) with check (
    public.is_admin()
    or (kind = 'member_gym' and (user_id = auth.uid() or public.owns_gym(gym_id)))
    or (kind = 'admin_user' and (user_id = auth.uid() or public.is_admin()))
    or (kind = 'contact_form' and public.owns_gym(gym_id))
  );

-- Messages read mirrors thread read.
create policy "messages_read" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.message_threads t
      where t.id = messages.thread_id
        and (
          public.is_admin()
          or (t.kind = 'member_gym' and (t.user_id = auth.uid() or public.owns_gym(t.gym_id)))
          or (t.kind = 'admin_user' and t.user_id = auth.uid())
          or (t.kind = 'contact_form' and public.owns_gym(t.gym_id))
        )
    )
  );

-- Messages insert: thread participants can write.
-- Anonymous senders can write the first message into a contact_form thread they just made.
create policy "messages_insert_authenticated" on public.messages
  for insert to authenticated with check (
    sender_user_id = auth.uid()
    and exists (
      select 1 from public.message_threads t
      where t.id = thread_id
        and (
          public.is_admin()
          or (t.kind = 'member_gym' and (t.user_id = auth.uid() or public.owns_gym(t.gym_id)))
          or (t.kind = 'admin_user' and (t.user_id = auth.uid() or public.is_admin()))
          or (t.kind = 'contact_form' and public.owns_gym(t.gym_id))
        )
    )
  );

create policy "messages_insert_anon" on public.messages
  for insert to anon with check (
    sender_is_anon = true
    and sender_user_id is null
    and exists (
      select 1 from public.message_threads t
      where t.id = thread_id and t.kind = 'contact_form'
    )
  );

-- ------------------------------------------------------------
-- Calendar / events / bookings
-- ------------------------------------------------------------
create table if not exists public.gym_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null check (event_type in ('class','event','open_slot')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int check (capacity is null or capacity >= 1),
  recurrence text check (recurrence is null or recurrence = 'weekly'),
  recurrence_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gym_events_gym_idx on public.gym_events(gym_id, starts_at);

create trigger gym_events_set_updated_at
  before update on public.gym_events
  for each row execute function public.set_updated_at();

create table if not exists public.gym_event_bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.gym_events(id) on delete cascade,
  occurrence_date date not null,
  member_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, occurrence_date, member_id)
);
create index if not exists gym_event_bookings_event_idx
  on public.gym_event_bookings(event_id, occurrence_date);
create index if not exists gym_event_bookings_member_idx
  on public.gym_event_bookings(member_id);

alter table public.gym_events enable row level security;
alter table public.gym_event_bookings enable row level security;

create policy "gym_events_public_read" on public.gym_events
  for select to anon, authenticated using (true);
create policy "gym_events_owner_write" on public.gym_events
  for all to authenticated
  using (public.is_admin() or public.owns_gym(gym_id))
  with check (public.is_admin() or public.owns_gym(gym_id));

-- Bookings: members see their own; gym owner sees all for their gym; admin sees all.
create policy "gym_event_bookings_read" on public.gym_event_bookings
  for select to authenticated using (
    public.is_admin()
    or member_id = auth.uid()
    or exists (
      select 1 from public.gym_events e
      where e.id = gym_event_bookings.event_id and public.owns_gym(e.gym_id)
    )
  );

-- A member books a slot if bookings_enabled for the gym and they're a member of that gym.
create policy "gym_event_bookings_member_insert" on public.gym_event_bookings
  for insert to authenticated with check (
    member_id = auth.uid()
    and exists (
      select 1
      from public.gym_events e
      join public.gym_modules m on m.gym_id = e.gym_id
      where e.id = gym_event_bookings.event_id
        and coalesce(m.bookings_enabled, false) = true
        and public.is_member_of(e.gym_id)
    )
  );

-- Member can cancel their own booking; owner of the gym can remove any.
create policy "gym_event_bookings_delete" on public.gym_event_bookings
  for delete to authenticated using (
    public.is_admin()
    or member_id = auth.uid()
    or exists (
      select 1 from public.gym_events e
      where e.id = gym_event_bookings.event_id and public.owns_gym(e.gym_id)
    )
  );

-- ------------------------------------------------------------
-- Module flag: bookings_enabled
-- ------------------------------------------------------------
alter table public.gym_modules
  add column if not exists bookings_enabled boolean not null default false;

-- Owner can flip their own gym's module flags (bookings, etc).
drop policy if exists "gym_modules_owner_update" on public.gym_modules;
create policy "gym_modules_owner_update" on public.gym_modules
  for update to authenticated
  using (public.owns_gym(gym_id))
  with check (public.owns_gym(gym_id));
