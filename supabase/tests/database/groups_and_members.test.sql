begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(43);

select has_table('public', 'groups', 'groups table exists');
select has_table('public', 'group_members', 'group_members table exists');

select columns_are(
  'public',
  'groups',
  array['id', 'name', 'created_by', 'created_at', 'dissolved_at'],
  'groups has the expected columns'
);
select columns_are(
  'public',
  'group_members',
  array['group_id', 'user_id', 'joined_at'],
  'group_members has the expected columns'
);

select col_type_is('public', 'groups', 'id', 'uuid', 'groups.id is uuid');
select col_type_is('public', 'groups', 'name', 'text', 'groups.name is text');
select col_type_is('public', 'groups', 'created_by', 'uuid', 'groups.created_by is uuid');
select col_type_is(
  'public',
  'groups',
  'created_at',
  'timestamp with time zone',
  'groups.created_at is timezone-aware'
);
select col_type_is(
  'public',
  'groups',
  'dissolved_at',
  'timestamp with time zone',
  'groups.dissolved_at is timezone-aware'
);
select col_type_is('public', 'group_members', 'group_id', 'uuid', 'group_members.group_id is uuid');
select col_type_is('public', 'group_members', 'user_id', 'uuid', 'group_members.user_id is uuid');
select col_type_is(
  'public',
  'group_members',
  'joined_at',
  'timestamp with time zone',
  'group_members.joined_at is timezone-aware'
);

select col_not_null('public', 'groups', 'id', 'groups.id is required');
select col_not_null('public', 'groups', 'name', 'groups.name is required');
select col_not_null('public', 'groups', 'created_by', 'groups.created_by is required');
select col_not_null('public', 'groups', 'created_at', 'groups.created_at is required');
select col_not_null('public', 'group_members', 'group_id', 'group_members.group_id is required');
select col_not_null('public', 'group_members', 'user_id', 'group_members.user_id is required');
select col_not_null('public', 'group_members', 'joined_at', 'group_members.joined_at is required');

select col_has_default('public', 'groups', 'id', 'groups.id has a default');
select col_has_default('public', 'groups', 'created_at', 'groups.created_at has a default');
select col_has_default('public', 'group_members', 'joined_at', 'group_members.joined_at has a default');

select col_is_pk('public', 'groups', 'id', 'groups.id is the primary key');
select col_is_pk(
  'public',
  'group_members',
  array['group_id', 'user_id'],
  'group membership is unique per group and user'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'groups_created_by_fkey'
      and conrelid = 'public.groups'::regclass
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'r'
  ),
  'groups.created_by restricts deletion of an owner'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'group_members_group_id_fkey'
      and conrelid = 'public.group_members'::regclass
      and confrelid = 'public.groups'::regclass
      and confdeltype = 'c'
  ),
  'group deletion cascades to memberships'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'group_members_user_id_fkey'
      and conrelid = 'public.group_members'::regclass
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ),
  'non-owner account deletion cascades to memberships'
);

select has_index(
  'public',
  'groups',
  'groups_created_by_idx',
  'groups.created_by is indexed'
);
select has_index(
  'public',
  'group_members',
  'group_members_user_id_idx',
  'group_members.user_id is indexed'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.groups'::regclass),
  'groups has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.group_members'::regclass),
  'group_members has row level security enabled'
);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000101', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000102', 'member@example.test');

select lives_ok(
  $$
    insert into public.groups (id, name, created_by)
    values (
      '10000000-0000-0000-0000-000000000101',
      '家族',
      '00000000-0000-0000-0000-000000000101'
    )
  $$,
  'a group with a valid name and owner can be created'
);
select throws_ok(
  $$
    insert into public.groups (id, name, created_by)
    values (
      '10000000-0000-0000-0000-000000000102',
      '',
      '00000000-0000-0000-0000-000000000101'
    )
  $$,
  '23514',
  null,
  'an empty group name is rejected'
);
select throws_ok(
  $$
    insert into public.groups (id, name, created_by)
    values (
      '10000000-0000-0000-0000-000000000103',
      ' 家族 ',
      '00000000-0000-0000-0000-000000000101'
    )
  $$,
  '23514',
  null,
  'a group name with surrounding whitespace is rejected'
);
select throws_ok(
  $$
    insert into public.groups (id, name, created_by)
    values (
      '10000000-0000-0000-0000-000000000104',
      repeat('a', 101),
      '00000000-0000-0000-0000-000000000101'
    )
  $$,
  '23514',
  null,
  'a group name longer than 100 characters is rejected'
);

select lives_ok(
  $$
    insert into public.group_members (group_id, user_id)
    values (
      '10000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000102'
    )
  $$,
  'a user can join an existing group'
);
select throws_ok(
  $$
    insert into public.group_members (group_id, user_id)
    values (
      '10000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000102'
    )
  $$,
  '23505',
  null,
  'the same user cannot join the same group twice'
);
select throws_ok(
  $$
    insert into public.group_members (group_id, user_id)
    values (
      '10000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000999'
    )
  $$,
  '23503',
  null,
  'an unknown user cannot join a group'
);

select lives_ok(
  $$delete from auth.users where id = '00000000-0000-0000-0000-000000000102'$$,
  'a non-owner account can be deleted'
);
select is(
  (
    select count(*)::integer
    from public.group_members
    where user_id = '00000000-0000-0000-0000-000000000102'
  ),
  0,
  'deleting a non-owner account removes its memberships'
);
select throws_ok(
  $$delete from auth.users where id = '00000000-0000-0000-0000-000000000101'$$,
  '23503',
  null,
  'a group owner cannot be deleted before ownership is resolved'
);
select lives_ok(
  $$delete from public.groups where id = '10000000-0000-0000-0000-000000000101'$$,
  'a group can be deleted'
);
select is(
  (
    select count(*)::integer
    from public.group_members
    where group_id = '10000000-0000-0000-0000-000000000101'
  ),
  0,
  'deleting a group removes its memberships'
);

select * from finish();
rollback;
