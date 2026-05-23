-- Emoji reactions for collab messages, plus realtime hookup.
create table if not exists public.wyld_collab_reactions (
  message_id uuid not null references public.wyld_collab_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists wyld_collab_reactions_msg_idx
  on public.wyld_collab_reactions(message_id);

alter table public.wyld_collab_reactions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='wyld_collab_reactions_read' and tablename='wyld_collab_reactions') then
    create policy "wyld_collab_reactions_read" on public.wyld_collab_reactions
      for select to authenticated using (public.is_wyld_team());
  end if;
  if not exists (select 1 from pg_policies where policyname='wyld_collab_reactions_write' and tablename='wyld_collab_reactions') then
    create policy "wyld_collab_reactions_write" on public.wyld_collab_reactions
      for all to authenticated
      using (public.is_wyld_team() and user_id = auth.uid())
      with check (public.is_wyld_team() and user_id = auth.uid());
  end if;
end $$;

alter publication supabase_realtime add table public.wyld_collab_reactions;
alter publication supabase_realtime add table public.wyld_collab_attachments;
alter publication supabase_realtime add table public.wyld_collab_channels;
