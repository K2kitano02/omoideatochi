begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_function('public', 'get_memory_post', array['uuid'], 'authorized memory details are available through RPC');

-- Shared synthetic fixtures. Include inside each test's rolled-back transaction.
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

select ok(prosecdef, 'detail RPC uses definer rights with explicit authorization')
from pg_proc where oid = 'public.get_memory_post(uuid)'::regprocedure;
select ok('search_path=""' = any(proconfig), 'detail RPC fixes search_path')
from pg_proc where oid = 'public.get_memory_post(uuid)'::regprocedure;
select ok(not has_function_privilege('anon', 'public.get_memory_post(uuid)', 'EXECUTE'), 'anonymous callers cannot execute details');
select ok(not has_function_privilege('service_role', 'public.get_memory_post(uuid)', 'EXECUTE'), 'service_role has no public detail RPC grant');
select ok(has_function_privilege('authenticated', 'public.get_memory_post(uuid)', 'EXECUTE'), 'authenticated callers can execute details');

set local role anon;
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001201')$$, '42501', null, 'anonymous details are denied');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001201')$$, '28000', 'authentication_required', 'an authenticated role still needs a user identity');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001001', true);
set local role authenticated;
select is((select discovery_radius_m from public.get_memory_post('00000000-0000-0000-0000-000000001201')), 0, 'owner can view private post without a location');
select is((select discovery_radius_m from public.get_memory_post('00000000-0000-0000-0000-000000001202')), 500, 'owner can view 500m post without a location');
select is((select discovery_radius_m from public.get_memory_post('00000000-0000-0000-0000-000000001203')), 1000, 'owner can view 1km post without a location');
select is((select latitude from public.get_memory_post('00000000-0000-0000-0000-000000001202')), 2::double precision, 'latitude is not longitude');
select is((select longitude from public.get_memory_post('00000000-0000-0000-0000-000000001202')), 1::double precision, 'longitude is not latitude');
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001204')$$, 'P0001', 'memory_not_found', 'third-party personal detail is hidden');
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001999')$$, 'P0001', 'memory_not_found', 'missing detail has the same error');
select throws_ok($$select * from public.get_memory_post(null)$$, 'P0001', 'memory_not_found', 'NULL detail does not reveal existence');
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001209')$$, 'P0001', 'memory_not_found', 'deleted personal detail is hidden');
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001210')$$, 'P0001', 'memory_not_found', 'deleted group detail is hidden');
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001208')$$, 'P0001', 'memory_not_found', 'dissolved group detail is hidden from its owner');
select is((select author_display_name from public.get_memory_post('00000000-0000-0000-0000-000000001205')), 'Former author', 'current members see the former author name');
select is((select author_display_name from public.get_memory_post('00000000-0000-0000-0000-000000001211')), null::text, 'missing profile does not hide an authorized post');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001005', true);
set local role authenticated;
select is((select memo from public.get_memory_post('00000000-0000-0000-0000-000000001205')), 'Shared past memory', 'a later member sees past posts');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001004', true);
set local role authenticated;
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001205')$$, 'P0001', 'memory_not_found', 'former author cannot view their former group post');
select is((select memo from public.get_memory_post('00000000-0000-0000-0000-000000001206')), 'Independent personal memory', 'former author retains their independent personal post');
reset role;

grant select on public.memory_posts to authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000001002', true);
set local role authenticated;
select results_eq(
  $$select id from public.memory_posts order by id$$,
  $$values ('00000000-0000-0000-0000-000000001205'::uuid), ('00000000-0000-0000-0000-000000001211'::uuid)$$,
  'RLS returns only active group posts for a member without personal posts'
);
reset role;
delete from public.group_members where group_id = '00000000-0000-0000-0000-000000001301' and user_id = '00000000-0000-0000-0000-000000001002';
set local role authenticated;
select is((select count(*) from public.memory_posts), 0::bigint, 'RLS revokes group reads after removal');
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001205')$$, 'P0001', 'memory_not_found', 'RPC revokes group detail after removal');
reset role;
insert into public.group_members (group_id, user_id) values ('00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001002');
set local role authenticated;
select is((select count(*) from public.memory_posts), 2::bigint, 'RLS restores group visibility after rejoining');
select lives_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001205')$$, 'RPC restores visibility after rejoining');
reset role;
update public.groups set dissolved_at = now() where id = '00000000-0000-0000-0000-000000001301';
set local role authenticated;
select is((select count(*) from public.memory_posts), 0::bigint, 'RLS excludes dissolved group posts with memberships retained');
select throws_ok($$select * from public.get_memory_post('00000000-0000-0000-0000-000000001205')$$, 'P0001', 'memory_not_found', 'RPC excludes dissolved group posts with memberships retained');
reset role;

select * from finish();
rollback;
