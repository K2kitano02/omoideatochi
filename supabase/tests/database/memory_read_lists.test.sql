begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select has_function('public', 'get_personal_memory_posts', array['integer', 'timestamp with time zone', 'uuid'], 'personal list RPC exists');
select has_function('public', 'get_group_memory_posts', array['uuid', 'integer', 'timestamp with time zone', 'uuid'], 'group list RPC exists');
-- Synthetic fixtures; all changes roll back with this test.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000001001', 'memory-owner@example.test', '{"display_name":"Owner"}'),
  ('00000000-0000-0000-0000-000000001002', 'memory-member@example.test', '{"display_name":"Member"}'),
  ('00000000-0000-0000-0000-000000001003', 'memory-outsider@example.test', '{"display_name":"Outsider"}'),
  ('00000000-0000-0000-0000-000000001004', 'memory-former@example.test', '{"display_name":"Former author"}'),
  ('00000000-0000-0000-0000-000000001005', 'memory-late@example.test', '{"display_name":"Late member"}'),
  ('00000000-0000-0000-0000-000000001006', 'memory-no-profile@example.test', '{}');

insert into public.groups (id, name, created_by, created_at, dissolved_at) values
  ('00000000-0000-0000-0000-000000001301', 'Shared', '00000000-0000-0000-0000-000000001001', '2000-01-01Z', null),
  ('00000000-0000-0000-0000-000000001302', 'Unselected', '00000000-0000-0000-0000-000000001001', '2000-01-01Z', null),
  ('00000000-0000-0000-0000-000000001303', 'Empty', '00000000-0000-0000-0000-000000001001', '2000-01-01Z', null),
  ('00000000-0000-0000-0000-000000001304', 'Dissolved', '00000000-0000-0000-0000-000000001001', '2000-01-01Z', '2000-02-01Z');
insert into public.group_members (group_id, user_id, joined_at) values
  ('00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001001', '2000-01-01Z'),
  ('00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001002', '2000-01-01Z'),
  ('00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001005', '2001-01-01Z'),
  ('00000000-0000-0000-0000-000000001302', '00000000-0000-0000-0000-000000001001', '2000-01-01Z'),
  ('00000000-0000-0000-0000-000000001303', '00000000-0000-0000-0000-000000001001', '2000-01-01Z'),
  ('00000000-0000-0000-0000-000000001303', '00000000-0000-0000-0000-000000001002', '2000-01-01Z'),
  ('00000000-0000-0000-0000-000000001304', '00000000-0000-0000-0000-000000001001', '2000-01-01Z'),
  ('00000000-0000-0000-0000-000000001304', '00000000-0000-0000-0000-000000001002', '2000-01-01Z');

insert into public.memory_photos (id, owner_id, object_key) values
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001001', 'test/read-owner'),
  ('00000000-0000-0000-0000-000000001103', '00000000-0000-0000-0000-000000001003', 'test/read-outsider'),
  ('00000000-0000-0000-0000-000000001104', '00000000-0000-0000-0000-000000001004', 'test/read-former'),
  ('00000000-0000-0000-0000-000000001106', '00000000-0000-0000-0000-000000001006', 'test/read-no-profile');

insert into public.memory_posts (
  id, author_id, kind, group_id, photo_id, location, captured_at,
  memo, discovery_radius_m, created_at, deleted_at
) values
  ('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000001001', 'personal', null, '00000000-0000-0000-0000-000000001101', 'SRID=4326;POINT(0 0)', '2000-01-01Z', 'Private', 0, '2000-01-03Z', null),
  ('00000000-0000-0000-0000-000000001202', '00000000-0000-0000-0000-000000001001', 'personal', null, '00000000-0000-0000-0000-000000001101', 'SRID=4326;POINT(1 2)', '2000-01-01Z', '500m', 500, '2000-01-02Z', null),
  ('00000000-0000-0000-0000-000000001203', '00000000-0000-0000-0000-000000001001', 'personal', null, '00000000-0000-0000-0000-000000001101', 'SRID=4326;POINT(3 4)', '2000-01-01Z', '1km', 1000, '2000-01-01Z', null),
  ('00000000-0000-0000-0000-000000001204', '00000000-0000-0000-0000-000000001003', 'personal', null, '00000000-0000-0000-0000-000000001103', 'SRID=4326;POINT(10 20)', '2000-01-01Z', 'Hidden friend memory', 1000, '2000-01-01Z', null),
  ('00000000-0000-0000-0000-000000001205', '00000000-0000-0000-0000-000000001004', 'group', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001104', 'SRID=4326;POINT(5 6)', '2000-01-01Z', 'Shared past memory', null, '2000-01-01Z', null),
  ('00000000-0000-0000-0000-000000001206', '00000000-0000-0000-0000-000000001004', 'personal', null, '00000000-0000-0000-0000-000000001104', 'SRID=4326;POINT(5 6)', '2000-01-01Z', 'Independent personal memory', 0, '2000-01-01Z', null),
  ('00000000-0000-0000-0000-000000001207', '00000000-0000-0000-0000-000000001001', 'group', '00000000-0000-0000-0000-000000001302', '00000000-0000-0000-0000-000000001101', 'SRID=4326;POINT(0 0)', '2000-01-01Z', 'Unselected group', null, '2000-01-01Z', null),
  ('00000000-0000-0000-0000-000000001208', '00000000-0000-0000-0000-000000001001', 'group', '00000000-0000-0000-0000-000000001304', '00000000-0000-0000-0000-000000001101', 'SRID=4326;POINT(0 0)', '2000-01-01Z', 'Dissolved group', null, '2000-01-01Z', null),
  ('00000000-0000-0000-0000-000000001209', '00000000-0000-0000-0000-000000001001', 'personal', null, '00000000-0000-0000-0000-000000001101', 'SRID=4326;POINT(0 0)', '2000-01-01Z', 'Deleted personal', 0, '2000-01-01Z', '2000-02-01Z'),
  ('00000000-0000-0000-0000-000000001210', '00000000-0000-0000-0000-000000001001', 'group', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001101', 'SRID=4326;POINT(0 0)', '2000-01-01Z', 'Deleted group memory', null, '2000-01-01Z', '2000-02-01Z'),
  ('00000000-0000-0000-0000-000000001211', '00000000-0000-0000-0000-000000001006', 'group', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001106', 'SRID=4326;POINT(0 0)', '2000-01-01Z', null, null, '2000-01-01Z', null);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001001', true);
set local role authenticated;
select results_eq(
  $$select post_id from public.get_personal_memory_posts()$$,
  $$values ('00000000-0000-0000-0000-000000001201'::uuid), ('00000000-0000-0000-0000-000000001202'::uuid), ('00000000-0000-0000-0000-000000001203'::uuid)$$,
  'personal list includes only own undeleted personal posts in newest-first order'
);
select results_eq(
  $$select post_id from public.get_group_memory_posts('00000000-0000-0000-0000-000000001301')$$,
  $$values ('00000000-0000-0000-0000-000000001211'::uuid), ('00000000-0000-0000-0000-000000001205'::uuid)$$,
  'group list excludes deleted posts and orders equal timestamps by descending id'
);
select is((select count(*) from public.get_group_memory_posts('00000000-0000-0000-0000-000000001303')), 0::bigint, 'an authorized empty group returns an empty list');
select throws_ok($$select * from public.get_group_memory_posts('00000000-0000-0000-0000-000000001999')$$, '42501', 'permission_denied', 'missing group list is denied');
select throws_ok($$select * from public.get_group_memory_posts('00000000-0000-0000-0000-000000001304')$$, '42501', 'permission_denied', 'dissolved group list is denied');
select throws_ok($$select * from public.get_group_memory_posts(null)$$, '42501', 'permission_denied', 'NULL group has the same denial');
select throws_ok($$select * from public.get_personal_memory_posts(null)$$, '22023', 'invalid_pagination', 'NULL page size is rejected');
select throws_ok($$select * from public.get_personal_memory_posts(0)$$, '22023', 'invalid_pagination', 'zero page size is rejected');
select throws_ok($$select * from public.get_personal_memory_posts(-1)$$, '22023', 'invalid_pagination', 'negative page size is rejected');
select throws_ok($$select * from public.get_personal_memory_posts(201)$$, '22023', 'invalid_pagination', 'excessive page size is rejected');
select throws_ok($$select * from public.get_personal_memory_posts(2, now(), null)$$, '22023', 'invalid_pagination', 'timestamp-only cursor is rejected');
select throws_ok($$select * from public.get_personal_memory_posts(2, null, '00000000-0000-0000-0000-000000001201')$$, '22023', 'invalid_pagination', 'id-only cursor is rejected');
select throws_ok($$select * from public.get_group_memory_posts('00000000-0000-0000-0000-000000001301', 201)$$, '22023', 'invalid_pagination', 'group page size uses the same validation');
reset role;

update public.memory_posts set created_at = '2000-01-03Z' where id in ('00000000-0000-0000-0000-000000001202', '00000000-0000-0000-0000-000000001203');
set local role authenticated;
select results_eq(
  $$select post_id from public.get_personal_memory_posts(2)$$,
  $$values ('00000000-0000-0000-0000-000000001203'::uuid), ('00000000-0000-0000-0000-000000001202'::uuid)$$,
  'first page is deterministic when creation times are equal'
);
select results_eq(
  $$select post_id from public.get_personal_memory_posts(2, '2000-01-03Z', '00000000-0000-0000-0000-000000001202')$$,
  $$values ('00000000-0000-0000-0000-000000001201'::uuid)$$,
  'next page has no duplicate or missing equal-time posts'
);
reset role;

insert into public.friend_relationships (requester_id, recipient_id) values ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000001003');
set local role authenticated;
select ok(
  not exists (select 1 from public.get_personal_memory_posts() where post_id = '00000000-0000-0000-0000-000000001204' or photo_id = '00000000-0000-0000-0000-000000001103' or memo = 'Hidden friend memory' or (latitude = 20 and longitude = 10)),
  'pending friend memory content and coordinates are never returned'
);
reset role;
update public.friend_relationships set status = 'accepted', resolved_at = now() where requester_id = '00000000-0000-0000-0000-000000001001';
set local role authenticated;
select ok(
  not exists (select 1 from public.get_personal_memory_posts() where post_id = '00000000-0000-0000-0000-000000001204' or photo_id = '00000000-0000-0000-0000-000000001103' or memo = 'Hidden friend memory' or (latitude = 20 and longitude = 10)),
  'accepted friendship does not unlock personal content in this API'
);
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001204')$$, 'P0001', 'memory_not_found', 'even accepted friends cannot retrieve undiscovered detail');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001002', true);
set local role authenticated;
select throws_ok($$select * from public.get_group_memory_posts('00000000-0000-0000-0000-000000001302')$$, '42501', 'permission_denied', 'another group membership does not grant access');
select lives_ok($$select public.leave_group('00000000-0000-0000-0000-000000001301')$$, 'member leaves using the actual lifecycle RPC');
select throws_ok($$select * from public.get_group_memory_posts('00000000-0000-0000-0000-000000001301', 2, '2000-01-01Z', '00000000-0000-0000-0000-000000001211')$$, '42501', 'permission_denied', 'old cursor cannot bypass leaving');
reset role;
insert into public.group_members (group_id, user_id) values ('00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001002');
set local role authenticated;
select is((select count(*) from public.get_group_memory_posts('00000000-0000-0000-0000-000000001301')), 2::bigint, 'rejoined member sees past posts');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001003', true);
set local role authenticated;
select throws_ok($$select * from public.get_group_memory_posts('00000000-0000-0000-0000-000000001301')$$, '42501', 'permission_denied', 'third party has the same denial as missing or dissolved groups');
reset role;

insert into public.memory_posts (author_id, kind, photo_id, location, captured_at)
select '00000000-0000-0000-0000-000000001001', 'personal', '00000000-0000-0000-0000-000000001101', 'SRID=4326;POINT(0 0)', now() from generate_series(1, 205);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001001', true);
set local role authenticated;
select is((select count(*) from public.get_personal_memory_posts()), 50::bigint, 'default list page is 50 records, not all saved posts');
select is((select count(*) from public.get_personal_memory_posts(200)), 200::bigint, 'maximum page is 200 records');
reset role;

select ok(prosecdef and 'search_path=""' = any(proconfig), 'list RPC uses fixed search_path and definer rights')
from pg_proc where oid in ('public.get_personal_memory_posts(integer,timestamptz,uuid)'::regprocedure, 'public.get_group_memory_posts(uuid,integer,timestamptz,uuid)'::regprocedure);
select ok(not has_function_privilege(role_name, function_name, 'EXECUTE'), role_name || ' cannot invoke ' || function_name)
from (values ('anon'), ('service_role')) as roles(role_name)
cross join (values ('public.get_personal_memory_posts(integer,timestamptz,uuid)'), ('public.get_group_memory_posts(uuid,integer,timestamptz,uuid)')) as functions(function_name);
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok($$select * from public.get_personal_memory_posts()$$, '28000', 'authentication_required', 'personal list checks user identity');
select throws_ok($$select * from public.get_group_memory_posts('00000000-0000-0000-0000-000000001301')$$, '28000', 'authentication_required', 'group list checks user identity');
reset role;
select * from finish();
rollback;
