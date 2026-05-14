-- Bear Gym FAQ page now uses structured items (q/a) instead of a single
-- body blob, so the public site can render an accordion.

update public.gym_pages
   set content = jsonb_build_object(
     'headline', 'Frequently asked',
     'intro', 'The questions we get most often — tap any to expand.',
     'items', jsonb_build_array(
       jsonb_build_object(
         'id', gen_random_uuid()::text,
         'q', 'Do I have to commit to a year?',
         'a', 'No. Membership is month-to-month, cancel anytime.'
       ),
       jsonb_build_object(
         'id', gen_random_uuid()::text,
         'q', 'Can I bring a friend?',
         'a', 'Members are financially responsible for anyone they let in. Friends are welcome on a drop-in pass — easier for everyone.'
       ),
       jsonb_build_object(
         'id', gen_random_uuid()::text,
         'q', 'Do you have showers?',
         'a', 'Yes — two on each side. Towel service is on you.'
       ),
       jsonb_build_object(
         'id', gen_random_uuid()::text,
         'q', 'Is there a coach on-site?',
         'a', E'Usually. Coaching block is Saturday 9–11 AM and free for members. Private coaching is bookable any time.'
       ),
       jsonb_build_object(
         'id', gen_random_uuid()::text,
         'q', 'How do I get in after hours?',
         'a', 'Once your membership is active and your waiver is signed, the smart lock recognizes your phone. Walk up, the door unlocks.'
       )
     )
   )
 where page_key = 'faq'
   and gym_id = (select id from public.gyms where slug = 'bear-gym');
