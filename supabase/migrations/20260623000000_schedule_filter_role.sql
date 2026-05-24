-- Extend schedule_manager_filters so we persist:
--   1) the role filter the user last had selected
--   2) filters for VIEW-mode users (employees browsing the read-only
--      schedule), not just managers. The table name is now a misnomer
--      but renaming would break references; the manager_user_id column
--      is treated as a generic user_id from here on.
--
-- role_filter is nullable: NULL means "All Roles".

alter table public.schedule_manager_filters
  add column if not exists role_filter text;
