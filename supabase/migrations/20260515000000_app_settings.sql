-- Singleton table holding app-wide config the admin can edit from the
-- dashboard. Today: base_url used to compute the live site URL for each
-- gym ({base_url}/g/{slug}). Adding more keys later just means more
-- columns.

create table if not exists public.app_settings (
  id integer primary key default 1,
  base_url text not null default 'https://wyldinc.app',
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into public.app_settings (id) values (1) on conflict do nothing;

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'app_settings_public_read' and tablename = 'app_settings') then
    create policy "app_settings_public_read" on public.app_settings
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'app_settings_admin_write' and tablename = 'app_settings') then
    create policy "app_settings_admin_write" on public.app_settings
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;
