-- Demo content for Bear Gym so the public site has something to show
-- right out of the box. No images — those need real uploads from the
-- owner. Idempotent: re-running won't dupe rows or stomp custom edits
-- (page rows are upserted, posts are inserted only when their slug
-- doesn't already exist).

do $$
declare
  v_gym_id uuid;
begin
  select id into v_gym_id from public.gyms where slug = 'bear-gym';
  if v_gym_id is null then
    raise notice 'Bear Gym not found; skipping demo content seed.';
    return;
  end if;

  -- Theme: warm brown to match the bear-gym vibe
  update public.gym_themes
     set primary_color = '#3D2817',
         accent_color  = '#B5651D'
   where gym_id = v_gym_id;

  -- Settings: contact, address, hours, social
  update public.gym_site_settings
     set contact_email   = 'info@beargym.com',
         contact_phone   = '(555) 555-0123',
         address_line1   = '1234 Iron Ridge Rd',
         city            = 'Boulder',
         state           = 'CO',
         zip             = '80302',
         hours           = jsonb_build_object(
           'mon', '5:00 AM - 11:00 PM',
           'tue', '5:00 AM - 11:00 PM',
           'wed', '5:00 AM - 11:00 PM',
           'thu', '5:00 AM - 11:00 PM',
           'fri', '5:00 AM - 11:00 PM',
           'sat', '7:00 AM - 9:00 PM',
           'sun', '7:00 AM - 9:00 PM'
         ),
         social_instagram = '@beargymboulder',
         social_facebook  = 'facebook.com/beargymboulder',
         social_x         = '@beargymboulder',
         social_tiktok    = '@beargymboulder',
         meta_description = 'Bear Gym — old-school strength training in Boulder. 24/7 access, no contracts, just work.'
   where gym_id = v_gym_id;

  -- Enable News and FAQ so the demo shows them off
  update public.gym_modules
     set news_enabled = true,
         faq_enabled  = true
   where gym_id = v_gym_id;

  -- Pages: upsert home / about / services / contact / news / faq
  insert into public.gym_pages (gym_id, page_key, content)
  values
    (
      v_gym_id, 'home',
      jsonb_build_object(
        'headline', 'Train Like a Bear.',
        'subheadline', 'Heavy iron. No chrome. No scenery. Just work.',
        'body',
          E'Bear Gym is a strength-first gym in Boulder. We''re not a "wellness club" — we''re a barbell gym for people who want to lift, get strong, and go home.\n\n' ||
          E'You won''t find a sauna here, and you won''t find a juice bar. You will find squat racks that don''t wobble, plates that fit, and a coach when you need one. Members get 24/7 door access — let yourself in, train at 5 AM or 11 PM, lock up behind you.\n\n' ||
          E'No contracts. No initiation fees. Pay monthly, cancel any time.'
      )
    ),
    (
      v_gym_id, 'about',
      jsonb_build_object(
        'headline', 'About Bear Gym',
        'body',
          E'Bear Gym opened in 2019 because the founders couldn''t find a single gym in town that took strength training seriously. So they built one.\n\n' ||
          E'We''re a small operation. The owners are also the coaches. We know our members by name. If you''re new to lifting, ask — someone will spot you, fix your setup, or write you a starting program.\n\n' ||
          E'What we believe: most people don''t need a 200-class catalog. They need a place that''s open when they''re free, equipment that works, and a small amount of coaching. We try to be that place.'
      )
    ),
    (
      v_gym_id, 'services',
      jsonb_build_object(
        'headline', 'What we offer',
        'body',
          E'Standard membership gets you 24/7 door access, every piece of equipment in the building, and free use of the open coaching block on Saturdays.\n\n' ||
          E'Drop-in passes are available for visitors and travelers. Personal coaching is bookable on top of any membership — see the schedule.'
      )
    ),
    (
      v_gym_id, 'contact',
      jsonb_build_object(
        'headline', 'Get in touch',
        'body',
          E'The fastest way to reach us is email — we usually reply within a day. If you want to come check out the place, we''re open the hours below; you can walk in any time and ask for a quick tour.\n\n' ||
          E'Members already have 24/7 access via the app.'
      )
    ),
    (
      v_gym_id, 'news',
      jsonb_build_object(
        'headline', 'News from Bear Gym',
        'body', E'Equipment updates, drop-in nights, the occasional gym story.'
      )
    ),
    (
      v_gym_id, 'faq',
      jsonb_build_object(
        'headline', 'Frequently asked',
        'body',
          E'Q: Do I have to commit to a year?\nA: No. Membership is month-to-month, cancel anytime.\n\n' ||
          E'Q: Can I bring a friend?\nA: Members are financially responsible for anyone they let in. Friends are welcome on a drop-in pass — easier for everyone.\n\n' ||
          E'Q: Do you have showers?\nA: Yes — two on each side, towel service is on you.\n\n' ||
          E'Q: Is there a coach on-site?\nA: Usually. Coaching block is Saturday 9–11 AM and free for members. Private coaching is bookable any time.'
      )
    )
  on conflict (gym_id, page_key) do update
    set content = excluded.content;

  -- Blog posts: insert only when missing
  insert into public.gym_news_posts (gym_id, slug, title, body, published_at)
  select v_gym_id, x.slug, x.title, x.body, x.published_at::timestamptz
  from (values
    (
      'welcome-to-the-new-bear-gym-site',
      'Welcome to the new Bear Gym site',
      E'New website, same gym. We rebuilt this so you can sign up, pay, and let yourself in without having to text us.\n\n' ||
      E'If you''re already a member, your dues stay where they are. Log in on the member login link in the top right to see your billing.\n\n' ||
      E'If you''re new, the "Become a member" button is the place to start. We''ll see you in here.',
      (now() - interval '7 days')::timestamptz::text
    ),
    (
      'new-squat-racks-just-dropped',
      'New squat racks just dropped',
      E'Two new Rogue Monster Lite racks went in this week. That brings us to six racks total and means we should never be in a queue, even at peak.\n\n' ||
      E'A note on the old wobbler in the corner: we kept it. It''s been with us since day one. We just bolted it back to the floor.\n\n' ||
      E'Come pull on the new ones. They''re solid.',
      (now() - interval '3 days')::timestamptz::text
    ),
    (
      'drop-in-policy-update',
      'Drop-in policy update',
      E'Quick heads up on drop-ins for traveling lifters and friends-of-members:\n\n' ||
      E'1. Day passes are $15 and bookable in the app. Same waiver as a regular membership.\n' ||
      E'2. Friends of members are welcome, but please don''t share your code. The waiver makes you financially responsible for anyone you let in, and that includes injuries.\n' ||
      E'3. Coaches are on the floor Saturday 9-11. If you''re visiting and want a quick form check, that''s the time to come.\n\n' ||
      E'Thanks for keeping the place a good place to lift.',
      (now() - interval '1 day')::timestamptz::text
    )
  ) as x(slug, title, body, published_at)
  where not exists (
    select 1 from public.gym_news_posts
    where gym_id = v_gym_id and slug = x.slug
  );
end $$;
