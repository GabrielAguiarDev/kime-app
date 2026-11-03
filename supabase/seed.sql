-- =============================================================================
-- DEV SEED: applied by `supabase db reset` (local only, never in production).
-- Two fixed test accounts, active in the same gym. Used by the dev-only
-- quick-login buttons on the sign-in screen (src/dev/devAccounts.ts).
--
--   professor@kimi.dev / kimi12345  → professor (gym owner)
--   aluno@kimi.dev     / kimi12345  → student
-- =============================================================================

do $$
declare
  v_professor uuid := '11111111-1111-1111-1111-111111111111';
  v_student   uuid := '22222222-2222-2222-2222-222222222222';
  v_gym       uuid := '33333333-3333-3333-3333-333333333333';
  v_user record;
begin
  for v_user in
    select * from (values
      (v_professor, 'professor@kimi.dev', 'Ana Souza'),
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

  insert into public.gyms (id, name, created_by)
  values (v_gym, 'Kimi Jiu-Jitsu (Teste)', v_professor);

  insert into public.memberships (gym_id, user_id, role, status, decided_by, decided_at) values
    (v_gym, v_professor, 'professor', 'active', v_professor, now()),
    (v_gym, v_student,   'student',   'active', v_professor, now());

  insert into public.gym_invites (gym_id, role, created_by) values
    (v_gym, 'student', v_professor),
    (v_gym, 'professor', v_professor);
end;
$$;
