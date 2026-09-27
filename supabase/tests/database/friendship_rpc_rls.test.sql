begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '00000000-0000-0000-0000-000000000901',
    'friend-rpc-a@example.test',
    '{"display_name":"あおい"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000902',
    'friend-rpc-b@example.test',
    '{"display_name":"はる"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000903',
    'friend-rpc-c@example.test',
    '{"display_name":"そら"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000904',
    'friend-rpc-no-profile@example.test',
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000905',
    'friend-rpc-e@example.test',
    '{"display_name":"りん"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000906',
    'friend-rpc-f@example.test',
    '{"display_name":"ゆう"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000907',
    'friend-rpc-g@example.test',
    '{"display_name":"なぎ"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000908',
    'friend-rpc-h@example.test',
    '{"display_name":"れい"}'::jsonb
  );

select has_function(
  'public',
  'get_my_friend_code',
  array[]::text[],
  'friend code retrieval RPC exists'
);
select has_function(
  'public',
  'regenerate_my_friend_code',
  array[]::text[],
  'friend code regeneration RPC exists'
);
select ok(
  coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.get_my_friend_code()'),
      'EXECUTE'
    ),
    false
  ),
  'authenticated users can retrieve their friend code'
);
select ok(
  not coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure('public.get_my_friend_code()'),
      'EXECUTE'
    ),
    false
  ),
  'anonymous users cannot retrieve friend codes'
);
select ok(
  coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.regenerate_my_friend_code()'),
      'EXECUTE'
    ),
    false
  ),
  'authenticated users can regenerate their friend code'
);
select ok(
  not coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure('public.regenerate_my_friend_code()'),
      'EXECUTE'
    ),
    false
  ),
  'anonymous users cannot regenerate friend codes'
);

set local role anon;
select throws_ok(
  $$select public.get_my_friend_code()$$,
  '42501',
  null,
  'anonymous users cannot execute friend code retrieval'
);
select throws_ok(
  $$select public.regenerate_my_friend_code()$$,
  '42501',
  null,
  'anonymous users cannot execute friend code regeneration'
);
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok(
  $$select public.get_my_friend_code()$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot retrieve a friend code'
);
select throws_ok(
  $$select public.regenerate_my_friend_code()$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot regenerate a friend code'
);
reset role;

create temporary table captured_friend_codes (
  capture_kind text not null,
  code text not null
) on commit drop;

grant insert, select on pg_temp.captured_friend_codes to authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
set local role authenticated;
insert into pg_temp.captured_friend_codes
values ('first', public.get_my_friend_code());
insert into pg_temp.captured_friend_codes
values ('second', public.get_my_friend_code());
reset role;

select is(
  (
    select count(*)::integer
    from public.friend_codes
    where user_id = '00000000-0000-0000-0000-000000000901'
  ),
  1,
  'repeated retrieval creates one friend code row'
);
select is(
  (
    select count(distinct code)::integer
    from pg_temp.captured_friend_codes
    where capture_kind in ('first', 'second')
  ),
  1,
  'repeated retrieval returns the same friend code'
);
select matches(
  (select code from pg_temp.captured_friend_codes where capture_kind = 'first'),
  '^[0-9A-F]{16}$',
  'retrieved friend code has the expected format'
);

update public.friend_codes
set updated_at = now() - interval '1 day'
where user_id = '00000000-0000-0000-0000-000000000901';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
set local role authenticated;
insert into pg_temp.captured_friend_codes
values ('regenerated', public.regenerate_my_friend_code());
reset role;

select isnt(
  (select code from pg_temp.captured_friend_codes where capture_kind = 'regenerated'),
  (select code from pg_temp.captured_friend_codes where capture_kind = 'first'),
  'regeneration replaces the previous friend code'
);
select is(
  (
    select code
    from public.friend_codes
    where user_id = '00000000-0000-0000-0000-000000000901'
  ),
  (select code from pg_temp.captured_friend_codes where capture_kind = 'regenerated'),
  'the regenerated code is stored for the user'
);
select cmp_ok(
  (
    select updated_at
    from public.friend_codes
    where user_id = '00000000-0000-0000-0000-000000000901'
  ),
  '>',
  now() - interval '1 minute',
  'regeneration refreshes the update time'
);

insert into public.friend_codes (user_id, code)
values
  ('00000000-0000-0000-0000-000000000902', '1111111111111111'),
  ('00000000-0000-0000-0000-000000000904', '2222222222222222'),
  ('00000000-0000-0000-0000-000000000905', '3333333333333333'),
  ('00000000-0000-0000-0000-000000000906', '4444444444444444'),
  ('00000000-0000-0000-0000-000000000907', '5555555555555555'),
  ('00000000-0000-0000-0000-000000000908', '6666666666666666');

insert into public.friend_relationships (
  requester_id,
  recipient_id,
  status,
  resolved_at
)
values
  (
    '00000000-0000-0000-0000-000000000905',
    '00000000-0000-0000-0000-000000000906',
    'accepted',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000907',
    '00000000-0000-0000-0000-000000000908',
    'rejected',
    now()
  );

select has_function(
  'public',
  'preview_friend_code',
  array['text'],
  'friend code preview RPC exists'
);
select has_function(
  'public',
  'create_friend_request',
  array['text'],
  'friend request creation RPC exists'
);

create temporary table captured_friend_previews (
  display_name text not null
) on commit drop;
create temporary table captured_friend_requests (
  capture_kind text not null,
  request_id uuid not null
) on commit drop;

grant insert, select on pg_temp.captured_friend_previews to authenticated;
grant insert, select on pg_temp.captured_friend_requests to authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
set local role authenticated;
insert into pg_temp.captured_friend_previews
select preview.display_name
from public.preview_friend_code('1111111111111111') as preview;
reset role;

select is(
  (select display_name from pg_temp.captured_friend_previews),
  'はる',
  'friend code preview returns the target display name'
);
select is(
  (
    select array_agg(key_name order by key_name)
    from (
      select result.display_name
      from public.preview_friend_code('1111111111111111') as result
    ) as preview
    cross join lateral jsonb_object_keys(to_jsonb(preview)) as key_name
  ),
  array['display_name']::text[],
  'friend code preview exposes only the display name'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
set local role authenticated;
select throws_ok(
  $$select * from public.preview_friend_code(null)$$,
  'P0001',
  'friend_code_not_found',
  'a null code is not found'
);
select throws_ok(
  $$select * from public.preview_friend_code('')$$,
  'P0001',
  'friend_code_not_found',
  'an empty code is not found'
);
select throws_ok(
  $$select * from public.preview_friend_code('111111111111111a')$$,
  'P0001',
  'friend_code_not_found',
  'a lowercase code is not found'
);
select throws_ok(
  $$select * from public.preview_friend_code(' 1111111111111111')$$,
  'P0001',
  'friend_code_not_found',
  'a code with whitespace is not found'
);
select throws_ok(
  $$select * from public.preview_friend_code('FFFFFFFFFFFFFFFF')$$,
  'P0001',
  'friend_code_not_found',
  'an unknown code is not found'
);
select throws_ok(
  $$select * from public.preview_friend_code('2222222222222222')$$,
  'P0001',
  'friend_code_not_found',
  'a code without a profile is not exposed'
);
select throws_ok(
  $$
    select *
    from public.preview_friend_code(
      (select code from pg_temp.captured_friend_codes where capture_kind = 'first')
    )
  $$,
  'P0001',
  'friend_code_not_found',
  'a regenerated old code cannot be previewed'
);
insert into pg_temp.captured_friend_requests
values ('normal', public.create_friend_request('1111111111111111'));
select throws_ok(
  $$select public.create_friend_request('1111111111111111')$$,
  'P0001',
  'friend_request_already_pending',
  'a duplicate outgoing pending request is rejected'
);
select throws_ok(
  $$
    select public.create_friend_request(
      (select code from pg_temp.captured_friend_codes where capture_kind = 'first')
    )
  $$,
  'P0001',
  'friend_code_not_found',
  'a regenerated old code cannot create a request'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.friend_relationships
    where id = (
      select request_id
      from pg_temp.captured_friend_requests
      where capture_kind = 'normal'
    )
      and requester_id = '00000000-0000-0000-0000-000000000901'
      and recipient_id = '00000000-0000-0000-0000-000000000902'
      and status = 'pending'
  ),
  1,
  'request creation stores one pending relationship'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', true);
set local role authenticated;
select throws_ok(
  $$select public.create_friend_request('1111111111111111')$$,
  'P0001',
  'cannot_friend_self',
  'a user cannot request themselves'
);
select throws_ok(
  $$
    select public.create_friend_request(
      (select code from pg_temp.captured_friend_codes where capture_kind = 'regenerated')
    )
  $$,
  'P0001',
  'friend_request_already_pending',
  'a reverse pending request is rejected'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000905', true);
set local role authenticated;
select throws_ok(
  $$select public.create_friend_request('4444444444444444')$$,
  'P0001',
  'already_friends',
  'an accepted friend cannot be requested again'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000907', true);
set local role authenticated;
insert into pg_temp.captured_friend_requests
values ('after_rejection', public.create_friend_request('6666666666666666'));
reset role;

select is(
  (
    select count(*)::integer
    from public.friend_relationships
    where requester_id in (
      '00000000-0000-0000-0000-000000000907',
      '00000000-0000-0000-0000-000000000908'
    )
      and recipient_id in (
        '00000000-0000-0000-0000-000000000907',
        '00000000-0000-0000-0000-000000000908'
      )
      and status = 'pending'
  ),
  1,
  'a new pending request can be created after rejection'
);

select has_function(
  'public',
  'list_received_friend_requests',
  array[]::text[],
  'received friend request list RPC exists'
);
select has_function(
  'public',
  'list_sent_friend_requests',
  array[]::text[],
  'sent friend request list RPC exists'
);
select has_function(
  'public',
  'resolve_friend_request',
  array['uuid', 'boolean'],
  'friend request resolution RPC exists'
);

create temporary table captured_received_requests (
  request_id uuid not null,
  requester_display_name text not null,
  created_at timestamptz not null
) on commit drop;
create temporary table captured_sent_requests (
  request_id uuid not null,
  recipient_display_name text not null,
  created_at timestamptz not null
) on commit drop;

grant insert, select on pg_temp.captured_received_requests to authenticated;
grant insert, select on pg_temp.captured_sent_requests to authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', true);
set local role authenticated;
insert into pg_temp.captured_received_requests
select * from public.list_received_friend_requests();
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
set local role authenticated;
insert into pg_temp.captured_sent_requests
select * from public.list_sent_friend_requests();
reset role;

select is(
  (select count(*)::integer from pg_temp.captured_received_requests),
  1,
  'a recipient sees their incoming pending request'
);
select is(
  (select requester_display_name from pg_temp.captured_received_requests),
  'あおい',
  'an incoming request contains the requester display name'
);
select is(
  (select count(*)::integer from pg_temp.captured_sent_requests),
  1,
  'a requester sees their outgoing pending request'
);
select is(
  (select recipient_display_name from pg_temp.captured_sent_requests),
  'はる',
  'an outgoing request contains the recipient display name'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', true);
select is(
  (
    select array_agg(key_name order by key_name)
    from (
      select * from public.list_received_friend_requests()
    ) as request_row
    cross join lateral jsonb_object_keys(to_jsonb(request_row)) as key_name
  ),
  array['created_at', 'request_id', 'requester_display_name']::text[],
  'incoming requests expose no user UUID or email'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000903', true);
set local role authenticated;
select is(
  (select count(*)::integer from public.list_received_friend_requests()),
  0,
  'an unrelated user sees no incoming requests'
);
select is(
  (select count(*)::integer from public.list_sent_friend_requests()),
  0,
  'an unrelated user sees no outgoing requests'
);
select throws_ok(
  format(
    'select public.resolve_friend_request(%L, true)',
    (select request_id from pg_temp.captured_received_requests)
  ),
  '42501',
  'permission_denied',
  'an unrelated user cannot resolve a request'
);
select throws_ok(
  $$select public.resolve_friend_request('ffffffff-ffff-ffff-ffff-ffffffffffff', true)$$,
  '42501',
  'permission_denied',
  'an unknown request does not reveal whether it exists'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
set local role authenticated;
select throws_ok(
  format(
    'select public.resolve_friend_request(%L, true)',
    (select request_id from pg_temp.captured_received_requests)
  ),
  '42501',
  'permission_denied',
  'the requester cannot resolve their own outgoing request'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', true);
set local role authenticated;
select throws_ok(
  format(
    'select public.resolve_friend_request(%L, null)',
    (select request_id from pg_temp.captured_received_requests)
  ),
  '22023',
  'invalid_argument',
  'a null resolution decision is rejected'
);
select is(
  public.resolve_friend_request(
    (select request_id from pg_temp.captured_received_requests),
    true
  ),
  'accepted',
  'the recipient can accept a pending request'
);
select throws_ok(
  format(
    'select public.resolve_friend_request(%L, false)',
    (select request_id from pg_temp.captured_received_requests)
  ),
  'P0001',
  'request_not_pending',
  'a resolved request cannot be processed again'
);
reset role;

select is(
  (
    select status
    from public.friend_relationships
    where id = (select request_id from pg_temp.captured_received_requests)
  ),
  'accepted',
  'acceptance persists the accepted status'
);
select cmp_ok(
  (
    select resolved_at
    from public.friend_relationships
    where id = (select request_id from pg_temp.captured_received_requests)
  ),
  '>=',
  (
    select created_at
    from public.friend_relationships
    where id = (select request_id from pg_temp.captured_received_requests)
  ),
  'acceptance records a valid resolution time'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000903', true);
set local role authenticated;
insert into pg_temp.captured_friend_requests
values ('to_reject', public.create_friend_request('1111111111111111'));
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', true);
set local role authenticated;
select is(
  public.resolve_friend_request(
    (
      select request_id
      from pg_temp.captured_friend_requests
      where capture_kind = 'to_reject'
    ),
    false
  ),
  'rejected',
  'the recipient can reject a pending request'
);
select is(
  (select count(*)::integer from public.list_received_friend_requests()),
  0,
  'processed requests disappear from the incoming pending list'
);
reset role;

select is(
  (
    select status
    from public.friend_relationships
    where id = (
      select request_id
      from pg_temp.captured_friend_requests
      where capture_kind = 'to_reject'
    )
  ),
  'rejected',
  'rejection persists the rejected status'
);

select has_function(
  'public',
  'list_friends',
  array[]::text[],
  'friend list RPC exists'
);
select has_function(
  'public',
  'remove_friend',
  array['uuid'],
  'friend removal RPC exists'
);

create temporary table captured_friends (
  relationship_id uuid not null,
  display_name text not null,
  accepted_at timestamptz not null
) on commit drop;
create temporary table captured_relationship_ids (
  relationship_kind text not null,
  relationship_id uuid not null
) on commit drop;

insert into pg_temp.captured_relationship_ids
select 'pending_907_908', id
from public.friend_relationships
where requester_id = '00000000-0000-0000-0000-000000000907'
  and recipient_id = '00000000-0000-0000-0000-000000000908'
  and status = 'pending';
insert into pg_temp.captured_relationship_ids
select 'accepted_905_906', id
from public.friend_relationships
where requester_id = '00000000-0000-0000-0000-000000000905'
  and recipient_id = '00000000-0000-0000-0000-000000000906'
  and status = 'accepted';

grant insert, select, delete on pg_temp.captured_friends to authenticated;
grant select on pg_temp.captured_relationship_ids to authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
set local role authenticated;
insert into pg_temp.captured_friends
select * from public.list_friends();
reset role;

select is(
  (select count(*)::integer from pg_temp.captured_friends),
  1,
  'a user sees one accepted friend'
);
select is(
  (select display_name from pg_temp.captured_friends),
  'はる',
  'friend list returns the other participant display name'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
select is(
  (
    select array_agg(key_name order by key_name)
    from (
      select * from public.list_friends()
    ) as friend_row
    cross join lateral jsonb_object_keys(to_jsonb(friend_row)) as key_name
  ),
  array['accepted_at', 'display_name', 'relationship_id']::text[],
  'friend list exposes no user UUID or email'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000903', true);
set local role authenticated;
select is(
  (select count(*)::integer from public.list_friends()),
  0,
  'an unrelated user sees no friends'
);
select throws_ok(
  format(
    'select public.remove_friend(%L)',
    (select relationship_id from pg_temp.captured_friends)
  ),
  '42501',
  'permission_denied',
  'an unrelated user cannot remove a friendship'
);
select throws_ok(
  $$select public.remove_friend('ffffffff-ffff-ffff-ffff-ffffffffffff')$$,
  '42501',
  'permission_denied',
  'an unknown relationship does not reveal whether it exists'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000907', true);
set local role authenticated;
select throws_ok(
  format(
    'select public.remove_friend(%L)',
    (
      select relationship_id
      from pg_temp.captured_relationship_ids
      where relationship_kind = 'pending_907_908'
    )
  ),
  '42501',
  'permission_denied',
  'a pending request cannot be removed as a friendship'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000902', true);
set local role authenticated;
select lives_ok(
  format(
    'select public.remove_friend(%L)',
    (select relationship_id from pg_temp.captured_friends)
  ),
  'the original recipient can remove an accepted friendship'
);
select is(
  (select count(*)::integer from public.list_friends()),
  0,
  'a removed friendship disappears from the friend list'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000901', true);
set local role authenticated;
select throws_ok(
  format(
    'select public.remove_friend(%L)',
    (select relationship_id from pg_temp.captured_friends)
  ),
  '42501',
  'permission_denied',
  'a removed relationship ID cannot be reused'
);
insert into pg_temp.captured_friend_requests
values ('after_removal', public.create_friend_request('1111111111111111'));
reset role;

select is(
  (
    select count(*)::integer
    from public.friend_relationships
    where id = (
      select request_id
      from pg_temp.captured_friend_requests
      where capture_kind = 'after_removal'
    )
      and status = 'pending'
  ),
  1,
  'a new request can be created after friendship removal'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000905', true);
set local role authenticated;
select lives_ok(
  format(
    'select public.remove_friend(%L)',
    (
      select relationship_id
      from pg_temp.captured_relationship_ids
      where relationship_kind = 'accepted_905_906'
    )
  ),
  'the original requester can remove an accepted friendship'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.friend_relationships
    where requester_id = '00000000-0000-0000-0000-000000000905'
      and recipient_id = '00000000-0000-0000-0000-000000000906'
      and status = 'accepted'
  ),
  0,
  'requester removal deletes the accepted relationship'
);

select ok(
  coalesce(has_function_privilege(
    'authenticated',
    to_regprocedure('public.preview_friend_code(text)'),
    'EXECUTE'
  ), false),
  'authenticated users can preview friend codes'
);
select ok(
  coalesce(has_function_privilege(
    'authenticated',
    to_regprocedure('public.create_friend_request(text)'),
    'EXECUTE'
  ), false),
  'authenticated users can create friend requests'
);
select ok(
  coalesce(has_function_privilege(
    'authenticated',
    to_regprocedure('public.list_received_friend_requests()'),
    'EXECUTE'
  ), false),
  'authenticated users can list received requests'
);
select ok(
  coalesce(has_function_privilege(
    'authenticated',
    to_regprocedure('public.list_sent_friend_requests()'),
    'EXECUTE'
  ), false),
  'authenticated users can list sent requests'
);
select ok(
  coalesce(has_function_privilege(
    'authenticated',
    to_regprocedure('public.resolve_friend_request(uuid,boolean)'),
    'EXECUTE'
  ), false),
  'authenticated users can resolve received requests'
);
select ok(
  coalesce(has_function_privilege(
    'authenticated',
    to_regprocedure('public.list_friends()'),
    'EXECUTE'
  ), false),
  'authenticated users can list friends'
);
select ok(
  coalesce(has_function_privilege(
    'authenticated',
    to_regprocedure('public.remove_friend(uuid)'),
    'EXECUTE'
  ), false),
  'authenticated users can remove friendships'
);

select ok(
  not coalesce(has_function_privilege(
    'anon',
    to_regprocedure('public.preview_friend_code(text)'),
    'EXECUTE'
  ), false),
  'anonymous users cannot preview friend codes'
);
select ok(
  not coalesce(has_function_privilege(
    'anon',
    to_regprocedure('public.create_friend_request(text)'),
    'EXECUTE'
  ), false),
  'anonymous users cannot create friend requests'
);
select ok(
  not coalesce(has_function_privilege(
    'anon',
    to_regprocedure('public.list_received_friend_requests()'),
    'EXECUTE'
  ), false),
  'anonymous users cannot list received requests'
);
select ok(
  not coalesce(has_function_privilege(
    'anon',
    to_regprocedure('public.list_sent_friend_requests()'),
    'EXECUTE'
  ), false),
  'anonymous users cannot list sent requests'
);
select ok(
  not coalesce(has_function_privilege(
    'anon',
    to_regprocedure('public.resolve_friend_request(uuid,boolean)'),
    'EXECUTE'
  ), false),
  'anonymous users cannot resolve requests'
);
select ok(
  not coalesce(has_function_privilege(
    'anon',
    to_regprocedure('public.list_friends()'),
    'EXECUTE'
  ), false),
  'anonymous users cannot list friends'
);
select ok(
  not coalesce(has_function_privilege(
    'anon',
    to_regprocedure('public.remove_friend(uuid)'),
    'EXECUTE'
  ), false),
  'anonymous users cannot remove friendships'
);

set local role anon;
select throws_ok(
  $$select public.preview_friend_code('0000000000000000')$$,
  '42501',
  null,
  'anonymous users cannot execute friend code preview'
);
select throws_ok(
  $$select public.create_friend_request('0000000000000000')$$,
  '42501',
  null,
  'anonymous users cannot execute friend request creation'
);
select throws_ok(
  $$select public.list_received_friend_requests()$$,
  '42501',
  null,
  'anonymous users cannot execute received request listing'
);
select throws_ok(
  $$select public.list_sent_friend_requests()$$,
  '42501',
  null,
  'anonymous users cannot execute sent request listing'
);
select throws_ok(
  $$select public.resolve_friend_request('ffffffff-ffff-ffff-ffff-ffffffffffff', true)$$,
  '42501',
  null,
  'anonymous users cannot execute request resolution'
);
select throws_ok(
  $$select public.list_friends()$$,
  '42501',
  null,
  'anonymous users cannot execute friend listing'
);
select throws_ok(
  $$select public.remove_friend('ffffffff-ffff-ffff-ffff-ffffffffffff')$$,
  '42501',
  null,
  'anonymous users cannot execute friendship removal'
);
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok(
  $$select public.preview_friend_code('0000000000000000')$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot preview friend codes'
);
select throws_ok(
  $$select public.create_friend_request('0000000000000000')$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot create friend requests'
);
select throws_ok(
  $$select public.list_received_friend_requests()$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot list received requests'
);
select throws_ok(
  $$select public.list_sent_friend_requests()$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot list sent requests'
);
select throws_ok(
  $$select public.resolve_friend_request('ffffffff-ffff-ffff-ffff-ffffffffffff', true)$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot resolve requests'
);
select throws_ok(
  $$select public.list_friends()$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot list friends'
);
select throws_ok(
  $$select public.remove_friend('ffffffff-ffff-ffff-ffff-ffffffffffff')$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot remove friendships'
);
reset role;

select ok(
  not has_table_privilege('authenticated', 'public.friend_codes', 'SELECT'),
  'authenticated clients still cannot read friend codes directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.friend_relationships', 'SELECT'),
  'authenticated clients still cannot read friendships directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.friend_relationships', 'INSERT'),
  'authenticated clients still cannot create friendships directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.friend_relationships', 'UPDATE'),
  'authenticated clients still cannot resolve friendships directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.friend_relationships', 'DELETE'),
  'authenticated clients still cannot remove friendships directly'
);

select * from finish();
rollback;
