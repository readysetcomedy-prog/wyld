-- gym_pages still had a composite PK (gym_id, page_key), which makes it
-- impossible to store a per-location override row alongside the default
-- (both share the same gym_id + page_key). The earlier multi-location
-- migration only swapped the *unique constraint*, not the PRIMARY KEY.
--
-- Move to a surrogate id PK; per-(gym,page) uniqueness is enforced by the
-- two partial indexes (one default row, one row per location).

alter table public.gym_pages drop constraint if exists gym_pages_pkey;

alter table public.gym_pages
  add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gym_pages_pkey' and conrelid = 'public.gym_pages'::regclass
  ) then
    alter table public.gym_pages add constraint gym_pages_pkey primary key (id);
  end if;
end $$;

create unique index if not exists gym_pages_default_uniq
  on public.gym_pages (gym_id, page_key) where location_id is null;
create unique index if not exists gym_pages_location_uniq
  on public.gym_pages (gym_id, location_id, page_key) where location_id is not null;
