begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select has_table('public', 'friend_codes', 'friend_codes table exists');
select columns_are(
  'public',
  'friend_codes',
  array['user_id', 'code', 'created_at', 'updated_at'],
  'friend_codes has only the expected columns'
);

select col_type_is('public', 'friend_codes', 'user_id', 'uuid', 'friend code user id is uuid');
select col_type_is('public', 'friend_codes', 'code', 'text', 'friend code is text');
select col_type_is(
  'public',
  'friend_codes',
  'created_at',
  'timestamp with time zone',
  'friend code creation time is timezone-aware'
);
select col_type_is(
  'public',
  'friend_codes',
  'updated_at',
  'timestamp with time zone',
  'friend code update time is timezone-aware'
);

select col_not_null('public', 'friend_codes', 'user_id', 'friend code user is required');
select col_not_null('public', 'friend_codes', 'code', 'friend code is required');
select col_not_null('public', 'friend_codes', 'created_at', 'friend code creation time is required');
select col_not_null('public', 'friend_codes', 'updated_at', 'friend code update time is required');
select col_has_default('public', 'friend_codes', 'code', 'friend code has a random default');
select col_has_default('public', 'friend_codes', 'created_at', 'friend code creation time has a default');
select col_has_default('public', 'friend_codes', 'updated_at', 'friend code update time has a default');
select col_is_pk('public', 'friend_codes', 'user_id', 'one friend code row exists per user');

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'friend_codes_user_id_fkey'
      and conrelid = 'public.friend_codes'::regclass
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ),
  'deleting an account cascades to its friend code'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'friend_codes_code_key'
      and conrelid = 'public.friend_codes'::regclass
      and contype = 'u'
  ),
  'friend codes are unique'
);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000801', 'friend-code-a@example.test'),
  ('00000000-0000-0000-0000-000000000802', 'friend-code-b@example.test'),
  ('00000000-0000-0000-0000-000000000803', 'friend-code-c@example.test');

select lives_ok(
  $$insert into public.friend_codes (user_id) values ('00000000-0000-0000-0000-000000000801')$$,
  'a random friend code can be generated'
);
select matches(
  (select code from public.friend_codes where user_id = '00000000-0000-0000-0000-000000000801'),
  '^[0-9A-F]{16}$',
  'generated friend code is 16 uppercase hexadecimal characters'
);
select throws_ok(
  $$insert into public.friend_codes (user_id, code) values ('00000000-0000-0000-0000-000000000802', 'INVALID-CODE')$$,
  '23514',
  null,
  'an invalid friend code format is rejected'
);
select lives_ok(
  $$insert into public.friend_codes (user_id, code) values ('00000000-0000-0000-0000-000000000802', '0123456789ABCDEF')$$,
  'a valid explicit friend code can be stored'
);
select throws_ok(
  $$insert into public.friend_codes (user_id, code) values ('00000000-0000-0000-0000-000000000803', '0123456789ABCDEF')$$,
  '23505',
  null,
  'duplicate friend codes are rejected'
);

select has_table(
  'public',
  'friend_relationships',
  'friend_relationships table exists'
);
select columns_are(
  'public',
  'friend_relationships',
  array[
    'id',
    'requester_id',
    'recipient_id',
    'status',
    'created_at',
    'resolved_at'
  ],
  'friend_relationships has only the expected columns'
);

select col_type_is('public', 'friend_relationships', 'id', 'uuid', 'relationship id is uuid');
select col_type_is(
  'public',
  'friend_relationships',
  'requester_id',
  'uuid',
  'relationship requester is uuid'
);
select col_type_is(
  'public',
  'friend_relationships',
  'recipient_id',
  'uuid',
  'relationship recipient is uuid'
);
select col_type_is('public', 'friend_relationships', 'status', 'text', 'relationship status is text');
select col_type_is(
  'public',
  'friend_relationships',
  'created_at',
  'timestamp with time zone',
  'relationship creation time is timezone-aware'
);
select col_type_is(
  'public',
  'friend_relationships',
  'resolved_at',
  'timestamp with time zone',
  'relationship resolution time is timezone-aware'
);

select col_not_null('public', 'friend_relationships', 'id', 'relationship id is required');
select col_not_null(
  'public',
  'friend_relationships',
  'requester_id',
  'relationship requester is required'
);
select col_not_null(
  'public',
  'friend_relationships',
  'recipient_id',
  'relationship recipient is required'
);
select col_not_null('public', 'friend_relationships', 'status', 'relationship status is required');
select col_not_null(
  'public',
  'friend_relationships',
  'created_at',
  'relationship creation time is required'
);
select col_is_null(
  'public',
  'friend_relationships',
  'resolved_at',
  'pending relationship has no resolution time'
);
select col_has_default('public', 'friend_relationships', 'id', 'relationship id has a default');
select col_has_default(
  'public',
  'friend_relationships',
  'status',
  'relationship status defaults to pending'
);
select col_has_default(
  'public',
  'friend_relationships',
  'created_at',
  'relationship creation time has a default'
);
select col_is_pk('public', 'friend_relationships', 'id', 'relationship id is the primary key');

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'friend_relationships_requester_id_fkey'
      and conrelid = 'public.friend_relationships'::regclass
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ),
  'deleting a requester cascades to their relationships'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'friend_relationships_recipient_id_fkey'
      and conrelid = 'public.friend_relationships'::regclass
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ),
  'deleting a recipient cascades to their relationships'
);
select has_index(
  'public',
  'friend_relationships',
  'friend_relationships_requester_id_idx',
  'relationship requester is indexed'
);
select has_index(
  'public',
  'friend_relationships',
  'friend_relationships_recipient_id_idx',
  'relationship recipient is indexed'
);
select has_index(
  'public',
  'friend_relationships',
  'friend_relationships_active_pair_idx',
  'active relationships have an unordered unique index'
);
select has_index(
  'public',
  'friend_relationships',
  'friend_relationships_requester_pending_idx',
  'outgoing pending requests are indexed'
);
select has_index(
  'public',
  'friend_relationships',
  'friend_relationships_recipient_pending_idx',
  'incoming pending requests are indexed'
);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000804', 'relationship-a@example.test'),
  ('00000000-0000-0000-0000-000000000805', 'relationship-b@example.test'),
  ('00000000-0000-0000-0000-000000000806', 'relationship-c@example.test'),
  ('00000000-0000-0000-0000-000000000807', 'relationship-d@example.test'),
  ('00000000-0000-0000-0000-000000000808', 'relationship-e@example.test'),
  ('00000000-0000-0000-0000-000000000809', 'relationship-f@example.test');

select throws_ok(
  $$
    insert into public.friend_relationships (requester_id, recipient_id)
    values (
      '00000000-0000-0000-0000-000000000804',
      '00000000-0000-0000-0000-000000000804'
    )
  $$,
  '23514',
  null,
  'a user cannot request themselves'
);
select throws_ok(
  $$
    insert into public.friend_relationships (requester_id, recipient_id, status)
    values (
      '00000000-0000-0000-0000-000000000804',
      '00000000-0000-0000-0000-000000000805',
      'blocked'
    )
  $$,
  '23514',
  null,
  'an unsupported relationship status is rejected'
);
select throws_ok(
  $$
    insert into public.friend_relationships (
      requester_id,
      recipient_id,
      status,
      resolved_at
    )
    values (
      '00000000-0000-0000-0000-000000000804',
      '00000000-0000-0000-0000-000000000805',
      'pending',
      now()
    )
  $$,
  '23514',
  null,
  'a pending request cannot have a resolution time'
);
select throws_ok(
  $$
    insert into public.friend_relationships (requester_id, recipient_id, status)
    values (
      '00000000-0000-0000-0000-000000000804',
      '00000000-0000-0000-0000-000000000805',
      'accepted'
    )
  $$,
  '23514',
  null,
  'an accepted relationship requires a resolution time'
);
select throws_ok(
  $$
    insert into public.friend_relationships (
      requester_id,
      recipient_id,
      status,
      created_at,
      resolved_at
    )
    values (
      '00000000-0000-0000-0000-000000000804',
      '00000000-0000-0000-0000-000000000805',
      'rejected',
      '2026-09-27 10:00:00+00',
      '2026-09-27 09:59:59+00'
    )
  $$,
  '23514',
  null,
  'a resolution cannot predate its request'
);
select lives_ok(
  $$
    insert into public.friend_relationships (requester_id, recipient_id)
    values (
      '00000000-0000-0000-0000-000000000804',
      '00000000-0000-0000-0000-000000000805'
    )
  $$,
  'a pending request can be created'
);
select throws_ok(
  $$
    insert into public.friend_relationships (requester_id, recipient_id)
    values (
      '00000000-0000-0000-0000-000000000805',
      '00000000-0000-0000-0000-000000000804'
    )
  $$,
  '23505',
  null,
  'a reverse pending request is rejected'
);
select lives_ok(
  $$
    insert into public.friend_relationships (
      requester_id,
      recipient_id,
      status,
      resolved_at
    )
    values (
      '00000000-0000-0000-0000-000000000806',
      '00000000-0000-0000-0000-000000000807',
      'accepted',
      now()
    )
  $$,
  'an accepted relationship can be stored'
);
select throws_ok(
  $$
    insert into public.friend_relationships (requester_id, recipient_id)
    values (
      '00000000-0000-0000-0000-000000000807',
      '00000000-0000-0000-0000-000000000806'
    )
  $$,
  '23505',
  null,
  'an accepted relationship blocks a new reverse request'
);
select lives_ok(
  $$
    insert into public.friend_relationships (
      requester_id,
      recipient_id,
      status,
      resolved_at
    )
    values (
      '00000000-0000-0000-0000-000000000808',
      '00000000-0000-0000-0000-000000000809',
      'rejected',
      now()
    )
  $$,
  'a rejected request can be stored as history'
);
select lives_ok(
  $$
    insert into public.friend_relationships (requester_id, recipient_id)
    values (
      '00000000-0000-0000-0000-000000000809',
      '00000000-0000-0000-0000-000000000808'
    )
  $$,
  'a new request can be created after rejection'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.friend_codes'::regclass),
  'friend_codes has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.friend_relationships'::regclass),
  'friend_relationships has row level security enabled'
);
select is(
  has_table_privilege('anon', 'public.friend_codes', 'select'),
  false,
  'anonymous users have no direct friend code read privilege'
);
select is(
  has_table_privilege('authenticated', 'public.friend_codes', 'insert'),
  false,
  'authenticated users have no direct friend code insert privilege'
);
select is(
  has_table_privilege('authenticated', 'public.friend_codes', 'update'),
  false,
  'authenticated users have no direct friend code update privilege'
);
select is(
  has_table_privilege('authenticated', 'public.friend_codes', 'delete'),
  false,
  'authenticated users have no direct friend code delete privilege'
);
select is(
  has_table_privilege('anon', 'public.friend_relationships', 'select'),
  false,
  'anonymous users have no direct relationship read privilege'
);
select is(
  has_table_privilege('authenticated', 'public.friend_relationships', 'insert'),
  false,
  'authenticated users have no direct relationship insert privilege'
);
select is(
  has_table_privilege('authenticated', 'public.friend_relationships', 'update'),
  false,
  'authenticated users have no direct relationship update privilege'
);
select is(
  has_table_privilege('authenticated', 'public.friend_relationships', 'delete'),
  false,
  'authenticated users have no direct relationship delete privilege'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.friend_codes$$,
  '42501',
  null,
  'anonymous users cannot read friend codes directly'
);
select throws_ok(
  $$select count(*) from public.friend_relationships$$,
  '42501',
  null,
  'anonymous users cannot read relationships directly'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000804', true);
set local role authenticated;
select throws_ok(
  $$select count(*) from public.friend_codes$$,
  '42501',
  null,
  'authenticated users cannot read friend codes directly'
);
select throws_ok(
  $$
    insert into public.friend_relationships (requester_id, recipient_id)
    values (
      '00000000-0000-0000-0000-000000000804',
      '00000000-0000-0000-0000-000000000805'
    )
  $$,
  '42501',
  null,
  'authenticated users cannot insert relationships directly'
);
select throws_ok(
  $$update public.friend_relationships set status = 'rejected' where requester_id = '00000000-0000-0000-0000-000000000804'$$,
  '42501',
  null,
  'authenticated users cannot update relationships directly'
);
select throws_ok(
  $$delete from public.friend_relationships where requester_id = '00000000-0000-0000-0000-000000000804'$$,
  '42501',
  null,
  'authenticated users cannot delete relationships directly'
);
reset role;

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000810', 'group-friend-owner@example.test'),
  ('00000000-0000-0000-0000-000000000811', 'group-friend-member@example.test'),
  ('00000000-0000-0000-0000-000000000812', 'cascade-friend-a@example.test'),
  ('00000000-0000-0000-0000-000000000813', 'cascade-friend-b@example.test');

insert into public.groups (id, name, created_by)
values (
  '40000000-0000-0000-0000-000000000810',
  'Friend Schema Group',
  '00000000-0000-0000-0000-000000000810'
);
insert into public.group_members (group_id, user_id)
values (
  '40000000-0000-0000-0000-000000000810',
  '00000000-0000-0000-0000-000000000811'
);
select is(
  (
    select count(*)::integer
    from public.friend_relationships
    where requester_id in (
      '00000000-0000-0000-0000-000000000810',
      '00000000-0000-0000-0000-000000000811'
    )
      and recipient_id in (
        '00000000-0000-0000-0000-000000000810',
        '00000000-0000-0000-0000-000000000811'
      )
  ),
  0,
  'sharing a group does not create a friendship'
);

insert into public.friend_codes (user_id)
values ('00000000-0000-0000-0000-000000000812');
insert into public.friend_relationships (requester_id, recipient_id)
values (
  '00000000-0000-0000-0000-000000000812',
  '00000000-0000-0000-0000-000000000813'
);
delete from auth.users
where id = '00000000-0000-0000-0000-000000000812';
select is(
  (
    select count(*)::integer
    from public.friend_codes
    where user_id = '00000000-0000-0000-0000-000000000812'
  ),
  0,
  'deleting an account removes its friend code'
);
select is(
  (
    select count(*)::integer
    from public.friend_relationships
    where requester_id = '00000000-0000-0000-0000-000000000812'
      or recipient_id = '00000000-0000-0000-0000-000000000812'
  ),
  0,
  'deleting an account removes its friend relationships'
);

select * from finish();
rollback;
