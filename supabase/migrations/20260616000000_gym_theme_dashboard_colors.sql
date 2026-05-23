-- Dashboard branding: owners can pick separate colors for their owner
-- dashboard (vs. their public website). NULL means "fall back to the
-- website primary/accent" so existing gyms don't need to set them.

alter table public.gym_themes
  add column if not exists dashboard_primary_color text,
  add column if not exists dashboard_accent_color text;
