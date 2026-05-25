-- Turn on Supabase Realtime for every data-bearing public table so
-- inserts / updates / deletes anywhere in the app can drive live UI
-- updates. New tables in the future should be added here too — when
-- you create a new public table that holds data the user sees,
-- ALTER PUBLICATION supabase_realtime ADD TABLE it.
--
-- Idempotent: each ADD TABLE is wrapped in its own DO block so a
-- duplicate (already-in-publication) doesn't fail the whole migration.

do $$
declare
  tname text;
  tables text[] := array[
    -- core orgs / people
    'profiles', 'gyms', 'gym_modules', 'gym_themes', 'gym_site_settings',
    'gym_locations', 'gym_location_contacts', 'gym_memberships',
    'gym_employees', 'gym_employee_locations', 'gym_employee_credentials',
    'gym_employee_emergency_contacts', 'gym_roles',
    -- content + scheduling
    'gym_pages', 'gym_news_posts', 'gym_events', 'gym_event_bookings',
    'gym_products', 'gym_offerings', 'gym_packages', 'gym_package_offerings',
    'gym_marketing_assets', 'gym_waivers', 'gym_waiver_signatures',
    'gym_waiver_offerings',
    -- hiring
    'gym_job_postings', 'gym_job_applications',
    -- messaging
    'message_threads', 'messages',
    -- collab (most already in realtime; idempotent)
    'wyld_collab_channels', 'wyld_collab_channel_members',
    'wyld_collab_messages', 'wyld_collab_attachments',
    'wyld_collab_reactions', 'wyld_collab_mentions', 'wyld_collab_reads',
    -- schedule
    'schedule_shifts', 'schedule_absences', 'shift_pickup_requests',
    'schedule_history', 'schedule_manager_filters',
    -- time clock (already added in 20260624010000)
    'time_card_entries',
    -- billing / pricing
    'pricing_model', 'gym_setup_fees_paid',
    -- startup (already added previously)
    'startup_contributors', 'startup_expenses', 'startup_milestones',
    -- platform-wide settings
    'app_settings'
  ];
begin
  foreach tname in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tname);
    exception
      when duplicate_object then null;     -- already in publication
      when undefined_table then null;      -- table doesn't exist yet
    end;
  end loop;
end $$;
