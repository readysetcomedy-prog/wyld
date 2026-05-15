-- Stress-test seed for Bear Gym: 5 locations, many classes (recurring +
-- one-off, heavy in the current week), blog posts, products, and a couple
-- of per-location theme/page overrides. Idempotent: bails if already run.

-- The owner-guard trigger rejects module-flag changes from non-admin
-- callers; this seed runs as the migration role, so disable it briefly.
alter table public.gym_modules disable trigger gym_modules_owner_guard;

do $$
declare
  g uuid := '809e04bf-f1c2-4493-918f-0ee022226ee5';
  l_downtown  uuid := gen_random_uuid();
  l_north     uuid := gen_random_uuid();
  l_eastside  uuid := gen_random_uuid();
  l_pearl     uuid := gen_random_uuid();
  l_foothills uuid := gen_random_uuid();
  wk_mon     timestamptz := date_trunc('week', now());            -- Monday 00:00 this week
  recur_mon  timestamptz := date_trunc('week', now()) - interval '7 days';
  recur_to   date := (now() + interval '120 days')::date;
  day0       timestamptz := date_trunc('day', now());
begin
  if exists (select 1 from public.gym_locations where gym_id = g and slug = 'downtown') then
    raise notice 'Bear Gym stress seed already applied; skipping.';
    return;
  end if;

  update public.gym_modules
     set multi_location_enabled = true, max_locations = 8
   where gym_id = g;

  -- ----------------------------------------------------------
  -- 5 locations
  insert into public.gym_locations
    (id, gym_id, label, slug, address_line1, city, state, zip, display_order)
  values
    (l_downtown,  g, 'Downtown',      'downtown',      '88 Barbell Blvd',   'Boulder', 'CO', '80302', 10),
    (l_north,     g, 'North Boulder', 'north-boulder', '4120 Broadway',     'Boulder', 'CO', '80304', 11),
    (l_eastside,  g, 'East Side',     'east-side',     '2900 Valmont Rd',   'Boulder', 'CO', '80301', 12),
    (l_pearl,     g, 'Pearl Street',  'pearl-street',  '1100 Pearl St',     'Boulder', 'CO', '80302', 13),
    (l_foothills, g, 'Foothills',     'foothills',     '600 Table Mesa Dr', 'Boulder', 'CO', '80305', 14);

  insert into public.gym_location_contacts (location_id, kind, value, label, display_order) values
    (l_downtown,  'email', 'downtown@beargym.com',  'Front desk', 0),
    (l_downtown,  'phone', '(303) 555-0110',        'Front desk', 1),
    (l_downtown,  'phone', '(303) 555-0111',        'Coaching',   2),
    (l_north,     'email', 'north@beargym.com',     null,         0),
    (l_north,     'phone', '(303) 555-0120',        null,         1),
    (l_eastside,  'phone', '(303) 555-0130',        'Front desk', 0),
    (l_eastside,  'email', 'eastside@beargym.com',  'Front desk', 1),
    (l_pearl,     'email', 'pearl@beargym.com',     'Reception',  0),
    (l_pearl,     'phone', '(303) 555-0140',        'Reception',  1),
    (l_foothills, 'email', 'foothills@beargym.com', null,         0),
    (l_foothills, 'phone', '(303) 555-0150',        null,         1);

  -- ----------------------------------------------------------
  -- Recurring weekly classes. recur_mon = last week's Monday so expandEvents
  -- always projects an occurrence into the current week.
  insert into public.gym_events
    (gym_id, location_id, title, description, event_type, starts_at, ends_at, capacity, recurrence, recurrence_until)
  values
    (g, null, 'Sunrise Strength', 'Full-body barbell session to start the day.', 'class',
       recur_mon + interval '6 hours', recur_mon + interval '7 hours', 16, 'weekly', recur_to),
    (g, null, 'Barbell Club', 'Coached strength training for every level.', 'class',
       recur_mon + interval '18 hours', recur_mon + interval '19 hours 30 minutes', 20, 'weekly', recur_to),
    (g, null, 'Lunchtime Lift', 'Quick, focused 45-minute lift.', 'class',
       recur_mon + interval '1 day 12 hours', recur_mon + interval '1 day 12 hours 45 minutes', 12, 'weekly', recur_to),
    (g, l_downtown, 'Powerlifting Basics', 'Squat, bench, deadlift fundamentals.', 'class',
       recur_mon + interval '1 day 17 hours 30 minutes', recur_mon + interval '1 day 19 hours', 10, 'weekly', recur_to),
    (g, null, 'Sunrise Strength', 'Full-body barbell session to start the day.', 'class',
       recur_mon + interval '2 days 6 hours', recur_mon + interval '2 days 7 hours', 16, 'weekly', recur_to),
    (g, null, 'Olympic Lifting', 'Snatch and clean & jerk technique work.', 'class',
       recur_mon + interval '2 days 18 hours', recur_mon + interval '2 days 19 hours 30 minutes', 10, 'weekly', recur_to),
    (g, null, 'Lunchtime Lift', 'Quick, focused 45-minute lift.', 'class',
       recur_mon + interval '3 days 12 hours', recur_mon + interval '3 days 12 hours 45 minutes', 12, 'weekly', recur_to),
    (g, l_north, 'Strongman Night', 'Yokes, sleds, and stones.', 'class',
       recur_mon + interval '3 days 19 hours', recur_mon + interval '3 days 20 hours 30 minutes', 14, 'weekly', recur_to),
    (g, null, 'Friday Night Heavy', 'Go heavy to finish the week.', 'class',
       recur_mon + interval '4 days 17 hours 30 minutes', recur_mon + interval '4 days 19 hours', 24, 'weekly', recur_to),
    (g, null, 'Open Coaching Block', 'Drop in, a coach is on the floor.', 'open_slot',
       recur_mon + interval '5 days 9 hours', recur_mon + interval '5 days 12 hours', 30, 'weekly', recur_to),
    (g, null, 'Mobility & Recovery', 'Stretch, foam roll, reset.', 'class',
       recur_mon + interval '5 days 10 hours 30 minutes', recur_mon + interval '5 days 11 hours 30 minutes', 18, 'weekly', recur_to),
    (g, l_pearl, 'Saturday Barbell Social', 'Lift, then coffee next door.', 'class',
       recur_mon + interval '5 days 8 hours', recur_mon + interval '5 days 9 hours 30 minutes', 22, 'weekly', recur_to);

  -- ----------------------------------------------------------
  -- One-off events spread across the next several days (heavy current-week feed).
  insert into public.gym_events
    (gym_id, location_id, title, description, event_type, starts_at, ends_at, capacity, recurrence, recurrence_until)
  values
    (g, null, 'Deadlift Workshop', 'Dial in your setup and pull bigger.', 'event',
       day0 + interval '1 day 19 hours', day0 + interval '1 day 21 hours', 15, null, null),
    (g, l_downtown, 'Intro to Olympic Lifting', 'Beginner-friendly technique primer.', 'event',
       day0 + interval '1 day 12 hours', day0 + interval '1 day 13 hours 30 minutes', 10, null, null),
    (g, null, 'Member Mixer', 'Meet the crew. Snacks provided.', 'event',
       day0 + interval '2 days 18 hours', day0 + interval '2 days 20 hours', null, null, null),
    (g, l_downtown, 'PT Slot — Coach Mike', 'One-on-one personal training.', 'open_slot',
       day0 + interval '2 days 7 hours', day0 + interval '2 days 8 hours', 1, null, null),
    (g, null, 'New Member Orientation', 'Tour, gear check, and goal setting.', 'event',
       day0 + interval '3 days 19 hours', day0 + interval '3 days 20 hours', 8, null, null),
    (g, l_north, 'PT Slot — Coach Dana', 'One-on-one personal training.', 'open_slot',
       day0 + interval '3 days 8 hours', day0 + interval '3 days 9 hours', 1, null, null),
    (g, null, 'Bench Press Clinic', 'Arch, leg drive, and bar path.', 'event',
       day0 + interval '4 days 17 hours', day0 + interval '4 days 18 hours 30 minutes', 12, null, null),
    (g, l_pearl, 'Strongman Demo', 'Watch the strongman team train.', 'event',
       day0 + interval '5 days 11 hours', day0 + interval '5 days 12 hours 30 minutes', null, null, null),
    (g, null, 'PT Slot — Coach Mike', 'One-on-one personal training.', 'open_slot',
       day0 + interval '5 days 9 hours', day0 + interval '5 days 10 hours', 1, null, null),
    (g, null, 'Recovery & Stretch Open House', 'Try the recovery room free.', 'event',
       day0 + interval '6 days 10 hours', day0 + interval '6 days 11 hours', 20, null, null),
    (g, l_eastside, 'East Side Grand Opening', 'Ribbon cutting + free day passes.', 'event',
       day0 + interval '6 days 9 hours', day0 + interval '6 days 14 hours', null, null, null),
    (g, null, 'Form Check Friday', 'Bring a lift, get coached.', 'open_slot',
       day0 + interval '4 days 16 hours', day0 + interval '4 days 17 hours', 6, null, null);

  -- ----------------------------------------------------------
  -- Blog posts (mix of shared + per-location), varied publish dates.
  insert into public.gym_news_posts
    (gym_id, location_id, slug, title, body, published_at)
  values
    (g, null, 'spring-strength-challenge',
       'The Spring Strength Challenge starts Monday',
       E'Eight weeks. Three lifts. One leaderboard.\n\nSign up at the front desk and we will test your squat, bench, and deadlift on week one and week eight. Biggest total gain wins a year of membership.',
       now() - interval '3 days'),
    (g, null, 'why-we-do-not-have-a-juice-bar',
       'Why we still do not have a juice bar',
       E'People ask every week. The answer is the same: we would rather spend the money on more bars, more plates, and more platforms.\n\nA gym is for training. We will leave the smoothies to the smoothie people.',
       now() - interval '12 days'),
    (g, l_downtown, 'downtown-extended-hours',
       'Downtown is now open until midnight',
       E'The Downtown location now runs 5 AM to midnight, seven days a week.\n\nLate-shift workers asked, and we listened. Your key fob already works for the extended hours.',
       now() - interval '6 days'),
    (g, null, 'new-deadlift-platforms',
       'Four new deadlift platforms installed',
       E'We added four competition-spec platforms across our locations. That means less waiting and more pulling.\n\nDrop us a note if your home gym still feels crowded at peak hours.',
       now() - interval '21 days'),
    (g, l_north, 'north-boulder-strongman-team',
       'North Boulder is starting a strongman team',
       E'If you have ever wanted to flip a tire or carry a yoke, now is the time.\n\nThe North Boulder strongman team meets Thursday nights. No experience required, just a willingness to pick up heavy, awkward things.',
       now() - interval '9 days'),
    (g, null, 'member-spotlight-rosa',
       'Member spotlight: Rosa hit a 300 lb deadlift',
       E'Rosa joined eighteen months ago and could not deadlift 135. Last week she pulled 300.\n\nHer secret? She showed up. Three days a week, every week. That is the whole trick.',
       now() - interval '34 days'),
    (g, null, 'holiday-hours-2026',
       'Holiday hours and a note on guest passes',
       E'We will run on a reduced schedule over the holiday weekend. Check the schedule page for exact times at your location.\n\nGuest passes are free for the whole month, so bring a friend who needs a little push.',
       now() - interval '48 days'),
    (g, l_pearl, 'pearl-street-coffee-partnership',
       'Pearl Street members get free coffee next door',
       E'We teamed up with the cafe two doors down. Show your Bear Gym app after any session and the first coffee is on the house.',
       now() - interval '15 days');

  -- ----------------------------------------------------------
  -- Products (shared + per-location).
  insert into public.gym_products
    (gym_id, location_id, name, description, price_cents, sku, inventory_location, published, display_order)
  values
    (g, null, 'Bear Gym Tee', 'Heavyweight cotton tee with the bear logo.', 2800, 'TEE-001', 'Front desk shelf A', true, 0),
    (g, null, 'Bear Gym Hoodie', 'Midweight fleece hoodie, unisex sizing.', 5400, 'HOOD-001', 'Front desk shelf B', true, 1),
    (g, null, 'Lifting Chalk Block', 'Single 56g block of magnesium carbonate.', 350, 'CHALK-01', 'Back room bin 4', true, 2),
    (g, null, 'Stainless Shaker', 'Insulated 24oz shaker bottle.', 1900, 'SHAKE-01', 'Back room bin 7', true, 3),
    (g, l_downtown, 'Downtown Anniversary Tank', 'Limited run for the Downtown location.', 3200, 'TANK-DT1', 'Downtown counter', true, 4),
    (g, l_north, 'North Boulder Strongman Shirt', 'Strongman team shirt, North Boulder only.', 3000, 'SHIRT-NB1', 'North counter', true, 5),
    (g, null, 'Wrist Wraps', 'Stiff 18-inch wraps for heavy pressing.', 2200, 'WRAP-01', 'Back room bin 4', false, 6);

  -- ----------------------------------------------------------
  -- Per-location overrides to exercise the inheritance path.
  -- Downtown gets its own theme + home content; North Boulder gets a
  -- home headline override only.
  insert into public.gym_themes
    (gym_id, location_id, primary_color, accent_color, logo_url, style_preset, hero_variant, section_dividers)
  select g, l_downtown, '#1d4ed8', '#f97316', t.logo_url, 'bold', 'fullbleed', true
    from public.gym_themes t
   where t.gym_id = g and t.location_id is null
   limit 1;

  insert into public.gym_pages (gym_id, location_id, page_key, content)
  values
    (g, l_downtown, 'home', jsonb_build_object(
       'headline', 'Downtown Bear Gym',
       'subheadline', 'Open 5 AM to midnight in the heart of Boulder.',
       'body', E'The Downtown location is our flagship: 12,000 square feet of platforms, racks, and turf.\nWalk-ins welcome any time the doors are open.')),
    (g, l_north, 'home', jsonb_build_object(
       'headline', 'Bear Gym — North Boulder',
       'subheadline', 'Home of the North Boulder strongman team.',
       'body', E'North Boulder is built for the odd lifts: stones, yokes, sleds, and logs.\nIf you want to get strong in ways a barbell cannot teach, this is your room.'));

  raise notice 'Bear Gym stress seed applied.';
end $$;

alter table public.gym_modules enable trigger gym_modules_owner_guard;
