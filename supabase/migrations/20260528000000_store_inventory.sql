-- Store becomes an inventory tracker: on-hand quantity and unit cost.
alter table public.gym_products
  add column if not exists inventory_qty integer,
  add column if not exists cost_cents integer;
