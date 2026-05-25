-- Start-Up: tie expenses to contributors explicitly, drop the
-- "company paid directly" status, and turn cash_contributed into a
-- derived value (computed from logged expenses) instead of something
-- the admin types in.
--
-- 1) startup_expenses.contributor_id (FK -> startup_contributors).
--    Replaces the previous (paid_by_user_id | paid_by_label) dual
--    fields — the payer is now picked from a dropdown of existing
--    contributors. Old columns left on the table for backwards
--    compatibility but the UI no longer writes them.
-- 2) Convert any 'company_paid' rows to 'reimbursed' before tightening
--    the check constraint. For the Start-Up books any company-paid
--    expense is functionally already-reimbursed (the company paid out
--    of its own funds, not a contributor's pocket).
-- 3) Add a check constraint for the new (smaller) status set.
-- 4) Drop the old NOT NULL on description? No, keep that.

alter table public.startup_expenses
  add column if not exists contributor_id uuid references public.startup_contributors(id) on delete set null;

create index if not exists startup_expenses_contributor_idx
  on public.startup_expenses(contributor_id);

update public.startup_expenses
   set status = 'reimbursed'
 where status = 'company_paid';

alter table public.startup_expenses drop constraint if exists startup_expenses_status_check;
alter table public.startup_expenses
  add constraint startup_expenses_status_check
  check (status in ('unreimbursed', 'reimbursed'));
