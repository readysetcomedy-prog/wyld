-- Offerings & packages: a "what you get" perks checklist + a structured
-- billing period. Prepay term_options move from free-text labels to a
-- structured { count, price_cents } so the public site can compute the
-- discount % and per-period rate reliably.

alter table public.gym_offerings
  add column if not exists perks jsonb,
  add column if not exists billing_period text not null default 'month';

alter table public.gym_packages
  add column if not exists perks jsonb,
  add column if not exists billing_period text not null default 'month';

-- Best-effort backfill of billing_period from the old free-text unit_label.
update public.gym_offerings set billing_period = case
    when unit_label ilike '%week%' then 'week'
    when unit_label ilike '%day%' then 'day'
    when unit_label ilike '%session%' or unit_label ilike '%class%'
      or unit_label ilike '%visit%' then 'session'
    when unit_label ilike '%one%time%' or unit_label ilike '%once%' then 'one_time'
    else 'month'
  end
  where unit_label is not null and unit_label <> '';

update public.gym_packages set billing_period = case
    when unit_label ilike '%week%' then 'week'
    when unit_label ilike '%day%' then 'day'
    when unit_label ilike '%session%' or unit_label ilike '%class%'
      or unit_label ilike '%visit%' then 'session'
    when unit_label ilike '%one%time%' or unit_label ilike '%once%' then 'one_time'
    else 'month'
  end
  where unit_label is not null and unit_label <> '';

-- Best-effort conversion of legacy term_options ({label, price_cents}) to the
-- new structured shape ({count, price_cents}) when the label contains a
-- number. Labels with no number (e.g. "Annual") are left as-is; the public
-- site still renders those as plain rows until the owner re-saves them.
update public.gym_offerings o
set term_options = (
  select jsonb_agg(
    case
      when (t->>'count') is not null then t
      when (t->>'label') ~ '\d' then jsonb_build_object(
        'count', greatest((regexp_match(t->>'label', '\d+'))[1]::int, 2),
        'price_cents', (t->>'price_cents')::int
      )
      else t
    end
  )
  from jsonb_array_elements(o.term_options) t
)
where jsonb_typeof(term_options) = 'array'
  and jsonb_array_length(term_options) > 0;
