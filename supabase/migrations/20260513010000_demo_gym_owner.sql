-- Demo gym owner: bob@beargym.com / password 'demo' owning "Bear Gym".
-- For demo only — fake email, fake gym. Idempotent.

do $$
declare
  v_user_id uuid;
  v_gym_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = 'bob@beargym.com';

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'bob@beargym.com',
      crypt('demo', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Bob Bear"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  end if;

  -- handle_new_user fires on insert above and creates a profile with
  -- role='member'. Upsert to the right role/name regardless of source.
  insert into public.profiles (id, email, full_name, role)
  values (v_user_id, 'bob@beargym.com', 'Bob Bear', 'gym_owner')
  on conflict (id) do update
    set role = 'gym_owner', full_name = 'Bob Bear';

  select id into v_gym_id from public.gyms where lower(name) = 'bear gym';

  if v_gym_id is null then
    v_gym_id := gen_random_uuid();
    insert into public.gyms (id, name, city, state, join_code, owner_id)
    values (v_gym_id, 'Bear Gym', 'Demo City', 'CA', 'BEAR01', v_user_id);
  else
    update public.gyms set owner_id = v_user_id where id = v_gym_id;
  end if;

  update public.profiles set gym_id = v_gym_id where id = v_user_id;
end $$;
