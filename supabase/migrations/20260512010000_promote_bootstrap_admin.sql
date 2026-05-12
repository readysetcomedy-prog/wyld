-- Promote the bootstrap user to admin. The init migration's signup trigger
-- handles this for new signups, but a user who signed up before/around the
-- trigger being installed may still have role = 'member'. This statement is
-- idempotent and safe to re-run.

update public.profiles
  set role = 'admin'
  where lower(email) = 'readysetcomedy@gmail.com'
    and role is distinct from 'admin';
