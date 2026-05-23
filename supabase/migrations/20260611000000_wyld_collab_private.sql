-- Private channels: only invited members can see/post; admins are NOT
-- automatic — they need to be invited too. Plus tighter permissions on
-- channel + message deletes (creator/author or admin-who-is-a-member).

-- 1. Per-channel privacy flag (default false = public).
alter table public.wyld_collab_channels
  add column if not exists is_private boolean not null default false;

-- 2. Private channel membership.
create table if not exists public.wyld_collab_channel_members (
  channel_id uuid not null references public.wyld_collab_channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists wyld_collab_channel_members_user_idx
  on public.wyld_collab_channel_members(user_id);

-- 3. Visibility helper. Public channels are visible to any WyLD-team
--    member. Private channels are visible only to listed members. Admins
--    get no special pass — they have to be invited.
create or replace function public.can_see_collab_channel(p_channel_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_wyld_team()
    and exists (
      select 1
        from public.wyld_collab_channels c
       where c.id = p_channel_id
         and (
           c.is_private = false
           or exists (
             select 1
               from public.wyld_collab_channel_members m
              where m.channel_id = p_channel_id
                and m.user_id = auth.uid()
           )
         )
    );
$$;

-- 4. Atomic create + auto-add the creator as the first private-channel
--    member. Sidesteps the bootstrap problem where the creator can't yet
--    see the channel they just created.
create or replace function public.wyld_collab_create_channel(
  p_name text,
  p_slug text,
  p_description text,
  p_is_private boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_wyld_team() then
    raise exception 'forbidden: must be on the WyLD team';
  end if;
  insert into public.wyld_collab_channels (name, slug, description, is_private, created_by)
  values (p_name, p_slug, p_description, coalesce(p_is_private, false), auth.uid())
  returning id into v_id;
  if coalesce(p_is_private, false) then
    insert into public.wyld_collab_channel_members (channel_id, user_id, invited_by)
    values (v_id, auth.uid(), auth.uid())
    on conflict do nothing;
  end if;
  return v_id;
end $$;

-- 5. Replace the broad RLS policies with per-action ones that respect
--    visibility and ownership.
drop policy if exists "wyld_collab_channels_all"    on public.wyld_collab_channels;

create policy "wyld_collab_channels_read" on public.wyld_collab_channels
  for select to authenticated
  using (public.can_see_collab_channel(id));

create policy "wyld_collab_channels_insert" on public.wyld_collab_channels
  for insert to authenticated
  with check (public.is_wyld_team());

create policy "wyld_collab_channels_update" on public.wyld_collab_channels
  for update to authenticated
  using (
    (created_by = auth.uid() or public.is_admin())
    and public.can_see_collab_channel(id)
  )
  with check (
    (created_by = auth.uid() or public.is_admin())
    and public.can_see_collab_channel(id)
  );

create policy "wyld_collab_channels_delete" on public.wyld_collab_channels
  for delete to authenticated
  using (
    (created_by = auth.uid() or public.is_admin())
    and public.can_see_collab_channel(id)
  );

drop policy if exists "wyld_collab_messages_read"   on public.wyld_collab_messages;
drop policy if exists "wyld_collab_messages_insert" on public.wyld_collab_messages;
drop policy if exists "wyld_collab_messages_update" on public.wyld_collab_messages;
drop policy if exists "wyld_collab_messages_delete" on public.wyld_collab_messages;

create policy "wyld_collab_messages_read" on public.wyld_collab_messages
  for select to authenticated
  using (public.can_see_collab_channel(channel_id));

create policy "wyld_collab_messages_insert" on public.wyld_collab_messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.can_see_collab_channel(channel_id)
  );

create policy "wyld_collab_messages_update" on public.wyld_collab_messages
  for update to authenticated
  using (author_id = auth.uid() and public.can_see_collab_channel(channel_id))
  with check (author_id = auth.uid() and public.can_see_collab_channel(channel_id));

create policy "wyld_collab_messages_delete" on public.wyld_collab_messages
  for delete to authenticated
  using (
    public.can_see_collab_channel(channel_id)
    and (author_id = auth.uid() or public.is_admin())
  );

drop policy if exists "wyld_collab_attachments_all" on public.wyld_collab_attachments;
create policy "wyld_collab_attachments_all" on public.wyld_collab_attachments
  for all to authenticated
  using (
    exists (
      select 1 from public.wyld_collab_messages m
       where m.id = message_id
         and public.can_see_collab_channel(m.channel_id)
    )
  )
  with check (
    exists (
      select 1 from public.wyld_collab_messages m
       where m.id = message_id
         and public.can_see_collab_channel(m.channel_id)
    )
  );

drop policy if exists "wyld_collab_mentions_all" on public.wyld_collab_mentions;
create policy "wyld_collab_mentions_all" on public.wyld_collab_mentions
  for all to authenticated
  using (
    exists (
      select 1 from public.wyld_collab_messages m
       where m.id = message_id
         and public.can_see_collab_channel(m.channel_id)
    )
  )
  with check (
    exists (
      select 1 from public.wyld_collab_messages m
       where m.id = message_id
         and public.can_see_collab_channel(m.channel_id)
    )
  );

drop policy if exists "wyld_collab_reactions_read"  on public.wyld_collab_reactions;
drop policy if exists "wyld_collab_reactions_write" on public.wyld_collab_reactions;
create policy "wyld_collab_reactions_read" on public.wyld_collab_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.wyld_collab_messages m
       where m.id = message_id
         and public.can_see_collab_channel(m.channel_id)
    )
  );
create policy "wyld_collab_reactions_write" on public.wyld_collab_reactions
  for all to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.wyld_collab_messages m
       where m.id = message_id
         and public.can_see_collab_channel(m.channel_id)
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.wyld_collab_messages m
       where m.id = message_id
         and public.can_see_collab_channel(m.channel_id)
    )
  );

drop policy if exists "wyld_collab_reads_all" on public.wyld_collab_reads;
create policy "wyld_collab_reads_all" on public.wyld_collab_reads
  for all to authenticated
  using (user_id = auth.uid() and public.can_see_collab_channel(channel_id))
  with check (user_id = auth.uid() and public.can_see_collab_channel(channel_id));

-- 6. Channel members: read by any member; invite/remove by channel creator
--    or admin-who-is-a-member. Plus a self-leave escape hatch.
alter table public.wyld_collab_channel_members enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='wyld_collab_channel_members_read' and tablename='wyld_collab_channel_members') then
    create policy "wyld_collab_channel_members_read" on public.wyld_collab_channel_members
      for select to authenticated
      using (public.can_see_collab_channel(channel_id));
  end if;
  if not exists (select 1 from pg_policies where policyname='wyld_collab_channel_members_manage' and tablename='wyld_collab_channel_members') then
    create policy "wyld_collab_channel_members_manage" on public.wyld_collab_channel_members
      for all to authenticated
      using (
        exists (
          select 1 from public.wyld_collab_channels c
           where c.id = channel_id
             and (c.created_by = auth.uid() or public.is_admin())
             and public.can_see_collab_channel(c.id)
        )
      )
      with check (
        exists (
          select 1 from public.wyld_collab_channels c
           where c.id = channel_id
             and (c.created_by = auth.uid() or public.is_admin())
             and public.can_see_collab_channel(c.id)
        )
      );
  end if;
  if not exists (select 1 from pg_policies where policyname='wyld_collab_channel_members_self_leave' and tablename='wyld_collab_channel_members') then
    create policy "wyld_collab_channel_members_self_leave" on public.wyld_collab_channel_members
      for delete to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- 7. Update unread RPC to filter out channels the user can no longer see
--    (e.g. removed from a private channel they used to post in).
create or replace function public.wyld_collab_my_unread()
returns table (channel_id uuid, unread_count int)
language sql security definer set search_path = public as $$
  with my_channels as (
    select distinct channel_id
      from public.wyld_collab_messages
     where author_id = auth.uid()
    union
    select distinct m.channel_id
      from public.wyld_collab_messages m
      join public.wyld_collab_mentions men on men.message_id = m.id
     where men.user_id = auth.uid()
  )
  select
    mc.channel_id,
    (
      select count(*)::int
        from public.wyld_collab_messages msg
       where msg.channel_id = mc.channel_id
         and msg.author_id <> auth.uid()
         and msg.created_at > coalesce(
              (select last_read_at from public.wyld_collab_reads r
                where r.channel_id = mc.channel_id and r.user_id = auth.uid()),
              '1970-01-01'::timestamptz
            )
    ) as unread_count
  from my_channels mc
  where public.can_see_collab_channel(mc.channel_id);
$$;

alter publication supabase_realtime add table public.wyld_collab_channel_members;
