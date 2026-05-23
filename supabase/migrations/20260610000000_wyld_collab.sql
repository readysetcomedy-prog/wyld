-- WyLD internal team chat ("Collaboration" tab on the admin dashboard).
-- Slack-style channels, messages, image attachments, @mentions, and
-- per-user read tracking. Access gated to admins and WyLD employees who
-- have the perm_collaboration flag.

-- New per-employee permission flag. Default false; defaults are fine for
-- non-WyLD gyms (irrelevant to them) and for WyLD employees the admin
-- grants explicitly from the WyLD roster.
alter table public.gym_employees
  add column if not exists perm_collaboration boolean not null default false;

-- Who counts as "on the WyLD team" for collab purposes.
create or replace function public.is_wyld_team()
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or exists (
      select 1
        from public.gym_employees e
        join public.gyms g on g.id = e.gym_id
       where g.slug = 'wyld'
         and e.user_id = auth.uid()
         and e.perm_collaboration = true
    );
$$;

create table if not exists public.wyld_collab_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  archived boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wyld_collab_channels_active_idx
  on public.wyld_collab_channels(archived, created_at);

create table if not exists public.wyld_collab_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.wyld_collab_channels(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists wyld_collab_messages_channel_time_idx
  on public.wyld_collab_messages(channel_id, created_at);
create index if not exists wyld_collab_messages_author_idx
  on public.wyld_collab_messages(author_id, channel_id);

create table if not exists public.wyld_collab_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.wyld_collab_messages(id) on delete cascade,
  url text not null,
  kind text not null default 'image',
  width int,
  height int,
  created_at timestamptz not null default now(),
  check (kind in ('image','file'))
);
create index if not exists wyld_collab_attachments_msg_idx
  on public.wyld_collab_attachments(message_id);

create table if not exists public.wyld_collab_mentions (
  message_id uuid not null references public.wyld_collab_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (message_id, user_id)
);
create index if not exists wyld_collab_mentions_user_idx
  on public.wyld_collab_mentions(user_id);

create table if not exists public.wyld_collab_reads (
  channel_id uuid not null references public.wyld_collab_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

-- RLS — everything is gated to the WyLD team.
alter table public.wyld_collab_channels    enable row level security;
alter table public.wyld_collab_messages    enable row level security;
alter table public.wyld_collab_attachments enable row level security;
alter table public.wyld_collab_mentions    enable row level security;
alter table public.wyld_collab_reads       enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='wyld_collab_channels_all' and tablename='wyld_collab_channels') then
    create policy "wyld_collab_channels_all" on public.wyld_collab_channels
      for all to authenticated
      using (public.is_wyld_team())
      with check (public.is_wyld_team());
  end if;

  if not exists (select 1 from pg_policies where policyname='wyld_collab_messages_read' and tablename='wyld_collab_messages') then
    create policy "wyld_collab_messages_read" on public.wyld_collab_messages
      for select to authenticated using (public.is_wyld_team());
  end if;
  if not exists (select 1 from pg_policies where policyname='wyld_collab_messages_insert' and tablename='wyld_collab_messages') then
    create policy "wyld_collab_messages_insert" on public.wyld_collab_messages
      for insert to authenticated
      with check (public.is_wyld_team() and author_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname='wyld_collab_messages_update' and tablename='wyld_collab_messages') then
    create policy "wyld_collab_messages_update" on public.wyld_collab_messages
      for update to authenticated
      using (author_id = auth.uid() or public.is_admin())
      with check (author_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where policyname='wyld_collab_messages_delete' and tablename='wyld_collab_messages') then
    create policy "wyld_collab_messages_delete" on public.wyld_collab_messages
      for delete to authenticated
      using (author_id = auth.uid() or public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where policyname='wyld_collab_attachments_all' and tablename='wyld_collab_attachments') then
    create policy "wyld_collab_attachments_all" on public.wyld_collab_attachments
      for all to authenticated
      using (public.is_wyld_team())
      with check (public.is_wyld_team());
  end if;

  if not exists (select 1 from pg_policies where policyname='wyld_collab_mentions_all' and tablename='wyld_collab_mentions') then
    create policy "wyld_collab_mentions_all" on public.wyld_collab_mentions
      for all to authenticated
      using (public.is_wyld_team())
      with check (public.is_wyld_team());
  end if;

  if not exists (select 1 from pg_policies where policyname='wyld_collab_reads_all' and tablename='wyld_collab_reads') then
    create policy "wyld_collab_reads_all" on public.wyld_collab_reads
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- Seed a default "general" channel for the team, idempotently.
insert into public.wyld_collab_channels (name, slug, description)
select 'general', 'general', 'Everything WyLD — start here.'
where not exists (select 1 from public.wyld_collab_channels where slug='general');
