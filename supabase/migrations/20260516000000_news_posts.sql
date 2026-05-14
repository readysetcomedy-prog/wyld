-- Blog posts for the News module. One row per post, scoped to a gym.
-- Public read only sees published posts (published_at <= now()).

create table if not exists public.gym_news_posts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  slug text not null,
  title text not null,
  body text not null default '',
  cover_image_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, slug)
);

create index if not exists gym_news_posts_gym_published_idx
  on public.gym_news_posts (gym_id, published_at desc);

drop trigger if exists gym_news_posts_set_updated_at on public.gym_news_posts;
create trigger gym_news_posts_set_updated_at
  before update on public.gym_news_posts
  for each row execute function public.set_updated_at();

alter table public.gym_news_posts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'gym_news_posts_public_read' and tablename = 'gym_news_posts') then
    create policy "gym_news_posts_public_read" on public.gym_news_posts
      for select to anon, authenticated
      using (published_at is not null and published_at <= now());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_news_posts_owner_select' and tablename = 'gym_news_posts') then
    create policy "gym_news_posts_owner_select" on public.gym_news_posts
      for select to authenticated
      using (public.is_owner_of(gym_id) or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gym_news_posts_owner_write' and tablename = 'gym_news_posts') then
    create policy "gym_news_posts_owner_write" on public.gym_news_posts
      for all to authenticated
      using (public.is_owner_of(gym_id) or public.is_admin())
      with check (public.is_owner_of(gym_id) or public.is_admin());
  end if;
end $$;
