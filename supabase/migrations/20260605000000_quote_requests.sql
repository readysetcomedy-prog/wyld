-- "Get a Quote" requests from the public landing page. A SECURITY DEFINER
-- function lets an anonymous visitor file one as a gym-less contact_form
-- thread. With no gym_id, only admins can read it (per message_threads
-- RLS), so it lands in the admin message box.
create or replace function public.submit_quote_request(
  p_name text,
  p_email text,
  p_body text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  if coalesce(trim(p_name), '') = ''
     or coalesce(trim(p_email), '') = ''
     or coalesce(trim(p_body), '') = '' then
    raise exception 'Name, email, and message are all required.';
  end if;
  insert into public.message_threads (kind, gym_id, user_id, anon_name, anon_email, subject)
  values ('contact_form', null, null, trim(p_name), trim(p_email), 'Quote request')
  returning id into tid;
  insert into public.messages (thread_id, sender_is_anon, body)
  values (tid, true, trim(p_body));
end $$;

grant execute on function public.submit_quote_request(text, text, text) to anon, authenticated;
