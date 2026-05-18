-- Global pricing model: a single admin-controlled config that assigns a cost
-- to every feature, used by the admin Pricing tab (model editor + calculator)
-- and to compute each gym's estimated monthly cost. Stored as one JSON blob;
-- the math runs client-side. Admin-only — not readable by owners.

create table if not exists public.pricing_model (
  id integer primary key default 1,
  model jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint pricing_model_singleton check (id = 1)
);

insert into public.pricing_model (id) values (1) on conflict do nothing;

drop trigger if exists pricing_model_set_updated_at on public.pricing_model;
create trigger pricing_model_set_updated_at
  before update on public.pricing_model
  for each row execute function public.set_updated_at();

alter table public.pricing_model enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'pricing_model_admin_read' and tablename = 'pricing_model'
  ) then
    create policy "pricing_model_admin_read" on public.pricing_model
      for select to authenticated using (public.is_admin());
  end if;
  if not exists (
    select 1 from pg_policies
    where policyname = 'pricing_model_admin_write' and tablename = 'pricing_model'
  ) then
    create policy "pricing_model_admin_write" on public.pricing_model
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;
