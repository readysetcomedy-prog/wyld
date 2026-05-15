-- Contact-form fix + location-aware messages + store categories +
-- per-location hours.

-- Threads remember which location they came from.
alter table public.message_threads
  add column if not exists location_id uuid references public.gym_locations(id) on delete set null;
create index if not exists message_threads_location_idx
  on public.message_threads(location_id);

-- Store: category + featured flag.
alter table public.gym_products
  add column if not exists category text,
  add column if not exists featured boolean not null default false;

-- Per-location hours (jsonb { mon: '5:00 AM - 11:00 PM', ... }).
alter table public.gym_locations
  add column if not exists hours jsonb;

-- Anonymous contact-form submissions can't use insert().select() because
-- anon has no SELECT policy on message_threads (and shouldn't — that would
-- leak other visitors' submissions). A SECURITY DEFINER function creates the
-- thread + first message atomically without returning anything sensitive.
create or replace function public.submit_contact_message(
  p_gym_id uuid,
  p_location_id uuid,
  p_name text,
  p_email text,
  p_body text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_thread uuid;
begin
  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'Message body is required';
  end if;
  if p_name is null or btrim(p_name) = '' or p_email is null or btrim(p_email) = '' then
    raise exception 'Name and email are required';
  end if;
  if not exists (select 1 from public.gyms where id = p_gym_id) then
    raise exception 'Unknown gym';
  end if;
  insert into public.message_threads
    (kind, gym_id, location_id, anon_name, anon_email, subject)
  values
    ('contact_form', p_gym_id, p_location_id, btrim(p_name), btrim(p_email),
     'Contact form message')
  returning id into v_thread;
  insert into public.messages (thread_id, sender_is_anon, body)
  values (v_thread, true, btrim(p_body));
end $$;

grant execute on function public.submit_contact_message(uuid, uuid, text, text, text)
  to anon, authenticated;
