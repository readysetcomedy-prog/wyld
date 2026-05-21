-- Per-user unread counts for the collab sidebar + tab badge. Only counts
-- channels the user has actively engaged with (posted in or been mentioned
-- in) per the design call: "if I get curious about another feed, I'll go
-- look." Counts exclude messages the user wrote themselves.

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
  from my_channels mc;
$$;

-- Realtime subscribe so the UI gets new messages without polling.
alter publication supabase_realtime add table public.wyld_collab_messages;
alter publication supabase_realtime add table public.wyld_collab_reads;
