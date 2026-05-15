-- Site customization: style presets, hero variant, section dividers.
-- Curated knobs only — no raw control over every layout decision.

alter table public.gym_themes
  add column if not exists style_preset text not null default 'clean',
  add column if not exists hero_variant text not null default 'split',
  add column if not exists section_dividers boolean not null default false;

-- Constrain values via check constraints (drop-and-recreate so reruns work).
alter table public.gym_themes
  drop constraint if exists gym_themes_style_preset_check;
alter table public.gym_themes
  add constraint gym_themes_style_preset_check
  check (style_preset in ('clean','bold','warm','modern'));

alter table public.gym_themes
  drop constraint if exists gym_themes_hero_variant_check;
alter table public.gym_themes
  add constraint gym_themes_hero_variant_check
  check (hero_variant in ('split','fullbleed'));
