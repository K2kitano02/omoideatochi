begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select has_function('public', 'get_memory_map_posts', array['uuid[]', 'integer', 'timestamp with time zone', 'uuid'], 'minimal map RPC exists');
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
  $$select post_id from public.get_memory_map_posts()$$,
  $$values ('00000000-0000-0000-0000-000000001201'::uuid), ('00000000-0000-0000-0000-000000001202'::uuid), ('00000000-0000-0000-0000-000000001203'::uuid)$$,
  'default map returns only own undeleted personal posts'
);
select results_eq(
  $$select post_id from public.get_memory_map_posts(array['00000000-0000-0000-0000-000000001301'::uuid])$$,
  $$values ('00000000-0000-0000-0000-000000001201'::uuid), ('00000000-0000-0000-0000-000000001202'::uuid), ('00000000-0000-0000-0000-000000001211'::uuid), ('00000000-0000-0000-0000-000000001205'::uuid), ('00000000-0000-0000-0000-000000001203'::uuid)$$,
  'selected group is added without unselected groups or friend locations'
);
select is((select count(*) from public.get_memory_map_posts(array['00000000-0000-0000-0000-000000001301'::uuid, '00000000-0000-0000-0000-000000001301'::uuid])), 5::bigint, 'duplicate group selection does not duplicate posts');
select is(
  (select array_agg(key order by key) from (select jsonb_object_keys(to_jsonb(row)) as key from public.get_memory_map_posts('{}', 1) as row) as keys),
  array['created_at', 'group_id', 'kind', 'latitude', 'longitude', 'post_id']::text[],
  'map response has only minimal columns, no photos, author name or memo'
);
select is(
  (select array_agg(key order by key) from (select jsonb_object_keys(to_jsonb(row)) as key from public.get_memory_post('00000000-0000-0000-0000-000000001201') as row) as keys),
  array['author_display_name', 'author_id', 'captured_at', 'created_at', 'discovery_radius_m', 'group_id', 'kind', 'latitude', 'longitude', 'memo', 'photo_id', 'post_id']::text[],
  'detail response excludes storage keys, URLs and internal deletion state'
);
select is(
  (select array_agg(key order by key) from (select jsonb_object_keys(to_jsonb(row)) as key from public.get_personal_memory_posts(1) as row) as keys),
  array['author_display_name', 'author_id', 'captured_at', 'created_at', 'discovery_radius_m', 'group_id', 'kind', 'latitude', 'longitude', 'memo', 'photo_id', 'post_id']::text[],
  'list response has the same safe fields as detail'
);
select throws_ok($$select * from public.get_memory_map_posts(null)$$, '22023', 'invalid_group_selection', 'NULL group selection is invalid');
select throws_ok($$select * from public.get_memory_map_posts(array[null::uuid])$$, '22023', 'invalid_group_selection', 'NULL group id is invalid');
select throws_ok($$select * from public.get_memory_map_posts(array[['00000000-0000-0000-0000-000000001301'::uuid]])$$, '22023', 'invalid_group_selection', 'nested arrays are not a flat group selection');
select throws_ok($$select * from public.get_memory_map_posts(array['00000000-0000-0000-0000-000000001301'::uuid, '00000000-0000-0000-0000-000000001999'::uuid])$$, '42501', 'permission_denied', 'mixed authorized and nonexistent selections fail as a whole');
select throws_ok($$select * from public.get_memory_map_posts(array['00000000-0000-0000-0000-000000001304'::uuid])$$, '42501', 'permission_denied', 'dissolved group map selection is denied');
select throws_ok($$select * from public.get_memory_map_posts('{}', 0)$$, '22023', 'invalid_pagination', 'map uses page-size validation');
select throws_ok($$select * from public.get_memory_map_posts('{}', 2, now(), null)$$, '22023', 'invalid_pagination', 'map uses paired cursor validation');
select results_eq(
  $$select post_id from public.get_memory_map_posts('{}', 2, '2000-01-02Z', '00000000-0000-0000-0000-000000001202')$$,
  $$values ('00000000-0000-0000-0000-000000001203'::uuid)$$,
  'map supports reading the next page'
);
reset role;

-- A real owner action revokes member access on all three reading surfaces.
set local role authenticated;
select lives_ok($$select public.remove_group_member('00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001002')$$, 'owner removes a member using the existing RPC');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001002', true);
set local role authenticated;
select throws_ok($$select * from public.get_memory_map_posts(array['00000000-0000-0000-0000-000000001301'::uuid])$$, '42501', 'permission_denied', 'removed member map access is revoked');
select throws_ok($$select * from public.get_group_memory_posts('00000000-0000-0000-0000-000000001301')$$, '42501', 'permission_denied', 'removed member list access is revoked');
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001205')$$, 'P0001', 'memory_not_found', 'removed member detail access is revoked');
select is((select count(*) from public.get_memory_map_posts()), 0::bigint, 'former member default map has no foreign positions');
reset role;

-- Independent personal and group posts sharing a file remain independently readable.
update public.memory_posts set deleted_at = now() where id = '00000000-0000-0000-0000-000000001201';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001001', true);
set local role authenticated;
select lives_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001207')$$, 'personal deletion preserves shared-photo group detail');
select is((select count(*) from public.get_group_memory_posts('00000000-0000-0000-0000-000000001302')), 1::bigint, 'personal deletion preserves group list');
select ok(exists (select 1 from public.get_memory_map_posts(array['00000000-0000-0000-0000-000000001302'::uuid]) where post_id = '00000000-0000-0000-0000-000000001207'), 'personal deletion preserves group map point');
select ok(not exists (select 1 from public.get_personal_memory_posts() where post_id = '00000000-0000-0000-0000-000000001201'), 'deleted personal post disappears from list');
select ok(not exists (select 1 from public.get_memory_map_posts() where post_id = '00000000-0000-0000-0000-000000001201'), 'deleted personal post disappears from map');
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001201')$$, 'P0001', 'memory_not_found', 'deleted personal post disappears from detail');
reset role;
update public.memory_posts set deleted_at = now() where id = '00000000-0000-0000-0000-000000001207';
set local role authenticated;
select lives_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001202')$$, 'group deletion preserves shared-photo personal detail');
select is((select count(*) from public.get_personal_memory_posts()), 2::bigint, 'group deletion preserves personal list');
select is((select count(*) from public.get_memory_map_posts()), 2::bigint, 'group deletion preserves personal map');
select is((select count(*) from public.get_group_memory_posts('00000000-0000-0000-0000-000000001302')), 0::bigint, 'deleted group post disappears from list');
select ok(not exists (select 1 from public.get_memory_map_posts(array['00000000-0000-0000-0000-000000001302'::uuid]) where post_id = '00000000-0000-0000-0000-000000001207'), 'deleted group post disappears from map');
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001207')$$, 'P0001', 'memory_not_found', 'deleted group post disappears from detail');
select lives_ok($$select public.dissolve_group('00000000-0000-0000-0000-000000001301')$$, 'owner dissolves a group using the existing RPC');
select throws_ok($$select * from public.get_group_memory_posts('00000000-0000-0000-0000-000000001301')$$, '42501', 'permission_denied', 'dissolution revokes list access');
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001205')$$, 'P0001', 'memory_not_found', 'dissolution revokes detail access');
select throws_ok($$select * from public.get_memory_map_posts(array['00000000-0000-0000-0000-000000001301'::uuid])$$, '42501', 'permission_denied', 'dissolution revokes selected map access');
select is((select count(*) from public.get_memory_map_posts()), 2::bigint, 'dissolution does not hide independent personal posts');
reset role;

select ok(prosecdef and 'search_path=""' = any(proconfig), 'map RPC uses fixed search_path with explicit authorization')
from pg_proc where oid = 'public.get_memory_map_posts(uuid[],integer,timestamptz,uuid)'::regprocedure;
select ok(not has_function_privilege('anon', 'public.get_memory_map_posts(uuid[],integer,timestamptz,uuid)', 'EXECUTE'), 'anonymous callers cannot invoke map RPC');
select ok(not has_function_privilege('service_role', 'public.get_memory_map_posts(uuid[],integer,timestamptz,uuid)', 'EXECUTE'), 'map RPC execute is not granted to service role');
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok($$select * from public.get_memory_map_posts()$$, '28000', 'authentication_required', 'map RPC requires user identity');
reset role;

select * from finish();
rollback;
