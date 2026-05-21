-- Public-read storage bucket for collab image attachments. Uploads gated to
-- the WyLD team; reads are public so embedded image URLs render without an
-- auth round-trip.

insert into storage.buckets (id, name, public)
values ('wyld-collab', 'wyld-collab', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='wyld_collab_upload' and tablename='objects') then
    create policy "wyld_collab_upload" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'wyld-collab' and public.is_wyld_team());
  end if;
  if not exists (select 1 from pg_policies where policyname='wyld_collab_owner_delete' and tablename='objects') then
    create policy "wyld_collab_owner_delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'wyld-collab' and owner = auth.uid());
  end if;
end $$;
