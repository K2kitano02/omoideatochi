begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000701', 'profile-owner@example.test', '{"display_name":"なおき"}'::jsonb),
  ('00000000-0000-0000-0000-000000000702', 'profile-member@example.test', '{"display_name":"あや"}'::jsonb),
  ('00000000-0000-0000-0000-000000000703', 'profile-outsider@example.test', '{"display_name":"部外者"}'::jsonb),
  ('00000000-0000-0000-0000-000000000704', 'profile-missing@example.test', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000705', 'profile-other@example.test', '{"display_name":"別グループ"}'::jsonb);

insert into public.groups (id, name, created_by)
values
  ('40000000-0000-0000-0000-000000000701', 'Profile Group', '00000000-0000-0000-0000-000000000701'),
  ('40000000-0000-0000-0000-000000000705', 'Other Profile Group', '00000000-0000-0000-0000-000000000705');

insert into public.group_members (group_id, user_id)
values
  ('40000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000701'),
  ('40000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702'),
  ('40000000-0000-0000-0000-000000000705', '00000000-0000-0000-0000-000000000705');

select is(
  (select display_name from public.profiles where user_id = '00000000-0000-0000-0000-000000000701'),
  'なおき',
  'signup metadata creates a profile'
);
select is(
  (select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000704'),
  0,
  'an existing user without display name remains missing'
);
select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-000000000704', '')$$,
  '23514', null, 'empty display name is rejected'
);
select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-000000000704', ' name')$$,
  '23514', null, 'surrounding whitespace is rejected'
);
select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-000000000704', '1234567890123456')$$,
  '23514', null, 'display names longer than 15 characters are rejected'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);
set local role authenticated;
select is((select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000701'), 1, 'user reads their own profile');
select is((select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000702'), 1, 'user reads a shared group member profile');
select is((select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000703'), 0, 'user cannot read an unrelated profile');
select lives_ok(
  $$update public.profiles set display_name = 'ナオキ' where user_id = '00000000-0000-0000-0000-000000000701'$$,
  'user updates their own display name'
);
reset role;
select is((select display_name from public.profiles where user_id = '00000000-0000-0000-0000-000000000701'), 'ナオキ', 'own update is saved');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);
set local role authenticated;
select lives_ok(
  $$update public.profiles set display_name = '改ざん' where user_id = '00000000-0000-0000-0000-000000000702'$$,
  'updating another profile is ignored by RLS'
);
reset role;
select is((select display_name from public.profiles where user_id = '00000000-0000-0000-0000-000000000702'), 'あや', 'another profile is not changed');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000701', true);
set local role authenticated;
select throws_ok(
  $$delete from public.profiles where user_id = '00000000-0000-0000-0000-000000000701'$$,
  '42501', null, 'users cannot delete profiles directly'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000702', true);
set local role authenticated;
select is((select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000701'), 1, 'member reads the owner profile');
select is((select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000702'), 1, 'member reads their own profile');
select is((select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000705'), 0, 'member cannot read another group profile');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000703', true);
set local role authenticated;
select is((select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000703'), 1, 'outsider reads their own profile');
select is((select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000701'), 0, 'outsider cannot read group member profiles');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000704', true);
set local role authenticated;
select lives_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-000000000704', '既存利用者')$$,
  'existing user creates their own missing profile'
);
select is((select display_name from public.profiles where user_id = '00000000-0000-0000-0000-000000000704'), '既存利用者', 'existing user reads the created profile');
select lives_ok(
  $$update public.profiles set display_name = '変更後' where user_id = '00000000-0000-0000-0000-000000000704'$$,
  'existing user updates their own profile'
);
reset role;
select is((select display_name from public.profiles where user_id = '00000000-0000-0000-0000-000000000704'), '変更後', 'existing user update is saved');

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok($$select count(*) from public.profiles$$, '42501', null, 'anonymous user cannot read profiles');
select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-000000000704', '匿名')$$,
  '42501', null, 'anonymous user cannot insert profiles'
);
reset role;

set local role authenticated;
select is((select count(*)::integer from public.profiles), 0, 'authenticated role without user ID reads no profiles');
select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-000000000704', '識別なし')$$,
  '42501', null, 'authenticated role without user ID cannot insert profiles'
);
reset role;

delete from auth.users where id = '00000000-0000-0000-0000-000000000704';
select is((select count(*)::integer from public.profiles where user_id = '00000000-0000-0000-0000-000000000704'), 0, 'deleting auth user cascades to profile');

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-000000000706', 'invalid-profile@example.test', '{"display_name":"1234567890123456"}'::jsonb)$$,
  '23514', null, 'invalid signup display name rejects user creation'
);

select * from finish();
rollback;
