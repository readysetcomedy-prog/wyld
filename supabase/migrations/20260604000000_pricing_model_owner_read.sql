-- The owner Billing tab shows a gym's current monthly cost and upgrade
-- options, computed client-side from the pricing model. Allow any
-- authenticated user to read the model; writes stay admin-only.
drop policy if exists "pricing_model_admin_read" on public.pricing_model;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'pricing_model_authenticated_read'
      and tablename = 'pricing_model'
  ) then
    create policy "pricing_model_authenticated_read" on public.pricing_model
      for select to authenticated using (true);
  end if;
end $$;
