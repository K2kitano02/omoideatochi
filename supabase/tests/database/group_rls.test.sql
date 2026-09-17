begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(40);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000401', 'rls-owner-a@example.test'),
  ('00000000-0000-0000-0000-000000000402', 'rls-member-a@example.test'),
  ('00000000-0000-0000-0000-000000000403', 'rls-outsider@example.test'),
  ('00000000-0000-0000-0000-000000000404', 'rls-owner-b@example.test'),
  ('00000000-0000-0000-0000-000000000405', 'rls-rpc-owner@example.test');

insert into public.groups (id, name, created_by)
values
  ('40000000-0000-0000-0000-000000000401', 'Family A', '00000000-0000-0000-0000-000000000401'),
  ('40000000-0000-0000-0000-000000000404', 'Family B', '00000000-0000-0000-0000-000000000404');

insert into public.group_members (group_id, user_id)
values
  ('40000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000401'),
  ('40000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000402'),
  ('40000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000404');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
set local role authenticated;
select is((select count(*)::integer from public.groups where id = '40000000-0000-0000-0000-000000000401'), 1, 'owner reads their group');
select is((select count(*)::integer from public.groups where id = '40000000-0000-0000-0000-000000000404'), 0, 'owner cannot read another group');
select is((select count(*)::integer from public.group_members where group_id = '40000000-0000-0000-0000-000000000401'), 2, 'owner reads their member list');
select is((select count(*)::integer from public.group_members where group_id = '40000000-0000-0000-0000-000000000404'), 0, 'owner cannot read another member list');
select throws_ok(
  $$update public.groups set created_by = '00000000-0000-0000-0000-000000000403' where id = '40000000-0000-0000-0000-000000000401'$$,
  '42501', null, 'owner cannot transfer ownership by editing created_by'
);
select throws_ok(
  $$insert into public.group_members (group_id, user_id) values ('40000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000403')$$,
  '42501', null, 'owner cannot directly add a member'
);
select throws_ok(
  $$update public.group_members set user_id = '00000000-0000-0000-0000-000000000403' where group_id = '40000000-0000-0000-0000-000000000401' and user_id = '00000000-0000-0000-0000-000000000402'$$,
  '42501', null, 'owner cannot directly replace a member'
);
select throws_ok(
  $$delete from public.group_members where group_id = '40000000-0000-0000-0000-000000000401' and user_id = '00000000-0000-0000-0000-000000000402'$$,
  '42501', null, 'owner cannot directly remove a member'
);
select lives_ok(
  $$update public.groups set name = 'Family A updated' where id = '40000000-0000-0000-0000-000000000401'$$,
  'owner can update their group name'
);
reset role;
select is((select name from public.groups where id = '40000000-0000-0000-0000-000000000401'), 'Family A updated', 'owner name update is saved');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000402', true);
set local role authenticated;
select is((select count(*)::integer from public.groups where id = '40000000-0000-0000-0000-000000000401'), 1, 'member reads their group');
select is((select count(*)::integer from public.group_members where group_id = '40000000-0000-0000-0000-000000000401'), 2, 'member reads their group member list');
select is((select count(*)::integer from public.groups where id = '40000000-0000-0000-0000-000000000404'), 0, 'member cannot read an unrelated group');
select is((select count(*)::integer from public.group_members where group_id = '40000000-0000-0000-0000-000000000404'), 0, 'member cannot read an unrelated member list');
select lives_ok(
  $$update public.groups set name = 'Member changed' where id = '40000000-0000-0000-0000-000000000401'$$,
  'member name update is ignored by RLS'
);
select lives_ok(
  $$delete from public.groups where id = '40000000-0000-0000-0000-000000000401'$$,
  'member group deletion is ignored by RLS'
);
reset role;
select is((select name from public.groups where id = '40000000-0000-0000-0000-000000000401'), 'Family A updated', 'member did not change the group name');
select is((select count(*)::integer from public.groups where id = '40000000-0000-0000-0000-000000000401'), 1, 'member did not delete the group');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000403', true);
set local role authenticated;
select is((select count(*)::integer from public.groups), 0, 'outsider reads no groups');
select is((select count(*)::integer from public.group_members), 0, 'outsider reads no memberships');
select lives_ok(
  $$update public.groups set name = 'Outsider changed' where id = '40000000-0000-0000-0000-000000000401'$$,
  'outsider name update is ignored by RLS'
);
select lives_ok(
  $$delete from public.groups where id = '40000000-0000-0000-0000-000000000401'$$,
  'outsider group deletion is ignored by RLS'
);
reset role;
select is((select name from public.groups where id = '40000000-0000-0000-0000-000000000401'), 'Family A updated', 'outsider did not change the group name');
select is((select count(*)::integer from public.groups where id = '40000000-0000-0000-0000-000000000401'), 1, 'outsider did not delete the group');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000404', true);
set local role authenticated;
select is((select count(*)::integer from public.groups where id = '40000000-0000-0000-0000-000000000404'), 1, 'second owner reads their group');
select is((select count(*)::integer from public.groups where id = '40000000-0000-0000-0000-000000000401'), 0, 'second owner cannot read the first group');
select lives_ok(
  $$delete from public.groups where id = '40000000-0000-0000-0000-000000000404'$$,
  'second owner can delete their group'
);
reset role;
select is((select count(*)::integer from public.groups where id = '40000000-0000-0000-0000-000000000404'), 0, 'owner group deletion is saved');
select is((select count(*)::integer from public.group_members where group_id = '40000000-0000-0000-0000-000000000404'), 0, 'deleted group memberships cascade');

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok($$select count(*) from public.groups$$, '42501', null, 'anonymous user cannot read groups');
select throws_ok($$select count(*) from public.group_members$$, '42501', null, 'anonymous user cannot read memberships');
reset role;

set local role authenticated;
select is((select count(*)::integer from public.groups), 0, 'authenticated role without a user ID reads no groups');
select is((select count(*)::integer from public.group_members), 0, 'authenticated role without a user ID reads no memberships');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000405', true);
set local role authenticated;
select lives_ok($$select public.create_group('RPC group')$$, 'group creation RPC still works with RLS');
select is((select count(*)::integer from public.groups where created_by = '00000000-0000-0000-0000-000000000405'), 1, 'RPC creator reads the new group');
select is((select count(*)::integer from public.group_members where user_id = '00000000-0000-0000-0000-000000000405'), 1, 'RPC creator reads their membership');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000403', true);
set local role authenticated;
select is((select count(*)::integer from public.groups where created_by = '00000000-0000-0000-0000-000000000405'), 0, 'outsider cannot read a newly created group');
reset role;

delete from public.group_members
where group_id = '40000000-0000-0000-0000-000000000401'
  and user_id = '00000000-0000-0000-0000-000000000402';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000402', true);
set local role authenticated;
select is((select count(*)::integer from public.groups where id = '40000000-0000-0000-0000-000000000401'), 0, 'former member no longer reads the group');
select is((select count(*)::integer from public.group_members where group_id = '40000000-0000-0000-0000-000000000401'), 0, 'former member no longer reads the member list');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000401', true);
set local role authenticated;
select is((select count(*)::integer from public.groups where id = '40000000-0000-0000-0000-000000000401'), 1, 'owner still reads their group after member removal');
reset role;

select * from finish();
rollback;
