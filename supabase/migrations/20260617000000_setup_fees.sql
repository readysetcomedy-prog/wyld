-- Tracks one-time setup fees that have already been included on a paid
-- bill for a given gym. Setup fees only appear on a gym's bill the first
-- time a feature is toggled on; once recorded here, they don't reappear
-- even if the feature is later turned off and back on.
--
-- fee_key is either 'base' (the overall one-time setup fee on the pricing
-- model) or a feature key matching pricing_model.items.*  (e.g.
-- 'store_enabled', 'bookings_enabled'). amount_cents records what was
-- charged at the time, for the historical record / audit.

create table if not exists public.gym_setup_fees_paid (
  gym_id uuid not null references public.gyms(id) on delete cascade,
  fee_key text not null,
  amount_cents integer not null check (amount_cents >= 0),
  paid_at timestamptz not null default now(),
  primary key (gym_id, fee_key)
);

alter table public.gym_setup_fees_paid enable row level security;

-- Admin reads/writes anything; owners can read their own gym's paid-fees
-- list (for the billing display). No owner-side writes — the billing
-- system inserts these when a payment clears.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname='gym_setup_fees_paid_admin_all' and tablename='gym_setup_fees_paid'
  ) then
    create policy "gym_setup_fees_paid_admin_all" on public.gym_setup_fees_paid
      for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (
    select 1 from pg_policies
    where policyname='gym_setup_fees_paid_owner_read' and tablename='gym_setup_fees_paid'
  ) then
    create policy "gym_setup_fees_paid_owner_read" on public.gym_setup_fees_paid
      for select to authenticated using (public.owns_gym(gym_id));
  end if;
end $$;
