-- WyLD's internal admin "Start-Up" tracker.
--
-- Captures everything an early-stage org needs to monitor as a business
-- distinct from the SaaS platform itself: who's paid out-of-pocket for
-- what, who's a founder / investor / contributor (and how much they put
-- in), and which milestones / goals are open vs. done. Strictly admin-
-- only — owners and members never read these tables.

-- 1) Expenses paid out-of-pocket by founders, investors, or the company
-- itself. status tracks reimbursement state so we know what we still
-- owe whom.
create table if not exists public.startup_expenses (
  id uuid primary key default gen_random_uuid(),
  -- Who paid. Either a WyLD user (founder etc.) or a free-text label
  -- when the payer doesn't have a profile (vendor invoice, etc.).
  paid_by_user_id uuid references public.profiles(id) on delete set null,
  paid_by_label text,
  description text not null,
  category text,
  amount_cents integer not null check (amount_cents >= 0),
  paid_at date not null default current_date,
  status text not null default 'unreimbursed'
    check (status in ('unreimbursed', 'reimbursed', 'company_paid')),
  reimbursed_at date,
  notes text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists startup_expenses_paid_at_idx on public.startup_expenses(paid_at desc);
create index if not exists startup_expenses_paid_by_idx on public.startup_expenses(paid_by_user_id);
create index if not exists startup_expenses_status_idx on public.startup_expenses(status);

drop trigger if exists startup_expenses_set_updated_at on public.startup_expenses;
create trigger startup_expenses_set_updated_at
  before update on public.startup_expenses
  for each row execute function public.set_updated_at();

alter table public.startup_expenses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='startup_expenses_admin_all' and tablename='startup_expenses') then
    create policy "startup_expenses_admin_all" on public.startup_expenses
      for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;


-- 2) Founders / investors / advisors / early employees and what each
-- of them has put in. Equity is a percent; cash is in cents. Either
-- (or both) can be null/zero for advisor-style contributors.
create table if not exists public.startup_contributors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  role text,  -- free text: 'Founder', 'Investor', 'Advisor', etc.
  cash_contributed_cents integer not null default 0 check (cash_contributed_cents >= 0),
  equity_percent numeric(6,3) check (equity_percent is null or (equity_percent >= 0 and equity_percent <= 100)),
  notes text,
  joined_at date,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists startup_contributors_set_updated_at on public.startup_contributors;
create trigger startup_contributors_set_updated_at
  before update on public.startup_contributors
  for each row execute function public.set_updated_at();

alter table public.startup_contributors enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='startup_contributors_admin_all' and tablename='startup_contributors') then
    create policy "startup_contributors_admin_all" on public.startup_contributors
      for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;


-- 3) Milestones / goals — LLC formed, first paying customer, $1k MRR,
-- product launched, etc. Owners track open vs done so the team can
-- see momentum.
create table if not exists public.startup_milestones (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  target_date date,
  status text not null default 'open' check (status in ('open', 'done', 'archived')),
  completed_at timestamptz,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists startup_milestones_set_updated_at on public.startup_milestones;
create trigger startup_milestones_set_updated_at
  before update on public.startup_milestones
  for each row execute function public.set_updated_at();

alter table public.startup_milestones enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='startup_milestones_admin_all' and tablename='startup_milestones') then
    create policy "startup_milestones_admin_all" on public.startup_milestones
      for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
