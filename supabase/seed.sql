-- =============================================================================
-- DEV SEED: applied by `supabase db reset` (local only, never in production).
-- Three fixed test accounts, active in the same academy.
--
--   dono@kimi.dev      / kimi12345  → owner
--   professor@kimi.dev / kimi12345  → instructor ("Professor" in the app)
--   aluno@kimi.dev     / kimi12345  → student
--
-- Codes: student KMJJ2526, professor PRF2526K (single use, 7 days).
-- =============================================================================

do $$
declare
  v_owner     uuid := '11111111-1111-1111-1111-111111111111';
  v_professor uuid := '44444444-4444-4444-4444-444444444444';
  v_student   uuid := '22222222-2222-2222-2222-222222222222';
  v_academy   uuid := '33333333-3333-3333-3333-333333333333';
  v_user record;
  v_membership uuid;
  v_bjj uuid := '66666666-0000-0000-0000-000000000001';
  v_nogi uuid := '66666666-0000-0000-0000-000000000002';
  v_openmat uuid := '66666666-0000-0000-0000-000000000003';
begin
  for v_user in
    select * from (values
      (v_owner,     'dono@kimi.dev',      'Ana Souza'),
      (v_professor, 'professor@kimi.dev', 'Caio Mendes'),
      (v_student,   'aluno@kimi.dev',     'Beto Lima')
    ) as t (id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user.id, 'authenticated', 'authenticated',
      v_user.email, extensions.crypt('kimi12345', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', v_user.full_name),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user.id::text, v_user.id,
      jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
  -- profiles are created by the on_auth_user_created trigger.

  insert into public.academies (id, name, invite_code, created_by)
  values (v_academy, 'Kimi Jiu-Jitsu (Teste)', 'KMJJ2526', v_owner);

  insert into public.memberships (academy_id, user_id, role, status, decided_by, decided_at) values
    (v_academy, v_owner,     'owner',      'active', v_owner, now()),
    (v_academy, v_professor, 'instructor', 'active', v_owner, now()),
    (v_academy, v_student,   'student',    'active', v_owner, now());
  select id into v_membership from public.memberships where user_id = v_student and academy_id = v_academy;

  -- Jiu-Jitsu has belts; No-Gi and Open mat only count classes.
  insert into public.academy_modalities (id, academy_id, name, position, uses_belts) values
    (v_bjj, v_academy, 'Jiu-Jitsu', 0, true),
    (v_nogi, v_academy, 'No-Gi', 1, false),
    (v_openmat, v_academy, 'Open mat', 2, false);

  -- Professor code valid for 7 days from the reset.
  insert into public.professor_codes (academy_id, code, created_by)
  values (v_academy, 'PRF2526K', v_owner);

  -- White: classes without a belt; the rest count classes in the previous belt.
  insert into public.modality_belts (academy_id, modality_id, primary_color, tip_color, position, classes_required) values
    (v_academy, v_bjj, 'white', null, 0, 10), (v_academy, v_bjj, 'blue', null, 1, 40),
    (v_academy, v_bjj, 'purple', null, 2, 120), (v_academy, v_bjj, 'brown', null, 3, 240),
    (v_academy, v_bjj, 'black', null, 4, 360), (v_academy, v_bjj, 'black', 'red', 5, 500);

  insert into public.class_schedules (id, academy_id, weekday, start_time, modality_id) values
    ('55555555-0000-0000-0000-000000000001', v_academy, 1, '19:00', v_bjj),
    ('55555555-0000-0000-0000-000000000003', v_academy, 3, '19:00', v_bjj),
    ('55555555-0000-0000-0000-000000000005', v_academy, 5, '19:00', v_nogi),
    ('55555555-0000-0000-0000-000000000006', v_academy, 6, '10:00', v_openmat);

  -- The student got the white belt 6 weeks ago, then trained: 12 Jiu-Jitsu
  -- classes after it (progress toward blue) and ~6 No-Gi classes (total only).
  insert into public.belt_history (membership_id, belt_id, awarded_at)
  select v_membership, b.id, now() - interval '43 days'
  from public.modality_belts b where b.modality_id = v_bjj and b.position = 0;
  update public.belt_history set awarded_at = now() - interval '43 days' where membership_id = v_membership;

  insert into public.checkins (user_id, academy_id, schedule_id, class_date, status)
  select v_student, v_academy, s.id, d::date, 'confirmed'
  from generate_series(current_date - 42, current_date - 1, interval '1 day') d
  join public.class_schedules s on s.academy_id = v_academy and s.weekday = extract(dow from d)
  where s.start_time = '19:00';
end;
$$;
