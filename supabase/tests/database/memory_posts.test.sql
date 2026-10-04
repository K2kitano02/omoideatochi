begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select has_table('public', 'memory_photos', 'photo references can be stored');
select has_table('public', 'memory_posts', 'independent memory posts can be stored');

select columns_are(
  'public', 'memory_photos',
  array['id', 'owner_id', 'object_key', 'created_at'],
  'photo references contain metadata, not a public URL'
);
select columns_are(
  'public', 'memory_posts',
  array[
    'id', 'author_id', 'kind', 'group_id', 'photo_id', 'location',
    'captured_at', 'memo', 'discovery_radius_m', 'created_at', 'deleted_at'
  ],
  'posts contain independent destinations and deletion state'
);

select col_type_is('public', 'memory_photos', 'id', 'uuid', 'photo ids are UUIDs');
select col_type_is('public', 'memory_photos', 'owner_id', 'uuid', 'photo owners are UUIDs');
select col_type_is('public', 'memory_photos', 'object_key', 'text', 'photo keys are text');
select col_type_is('public', 'memory_posts', 'id', 'uuid', 'post ids are UUIDs');
select col_type_is('public', 'memory_posts', 'author_id', 'uuid', 'post authors are UUIDs');
select col_type_is('public', 'memory_posts', 'kind', 'text', 'post kind is text');
select col_type_is('public', 'memory_posts', 'group_id', 'uuid', 'group ids are UUIDs');
select col_type_is('public', 'memory_posts', 'photo_id', 'uuid', 'photo ids are UUIDs');
select col_type_is('public', 'memory_posts', 'memo', 'text', 'optional memo is text');
select col_type_is('public', 'memory_posts', 'discovery_radius_m', 'integer', 'radius is an integer');
select col_type_is(
  'public', 'memory_posts', 'location', 'geography(Point,4326)',
  'location is one WGS84 geographic point'
);
select col_type_is('public', 'memory_photos', 'created_at', 'timestamp with time zone', 'photo time has a timezone');
select col_type_is('public', 'memory_posts', 'captured_at', 'timestamp with time zone', 'capture time has a timezone');
select col_type_is('public', 'memory_posts', 'created_at', 'timestamp with time zone', 'post time has a timezone');
select col_type_is('public', 'memory_posts', 'deleted_at', 'timestamp with time zone', 'deletion time has a timezone');

select col_not_null('public', 'memory_photos', column_name, 'photo ' || column_name || ' is required')
from unnest(array['id', 'owner_id', 'object_key', 'created_at']) as column_name;
select col_not_null('public', 'memory_posts', column_name, 'post ' || column_name || ' is required')
from unnest(array['id', 'author_id', 'kind', 'photo_id', 'location', 'captured_at', 'created_at']) as column_name;
select col_is_null('public', 'memory_posts', column_name, 'post ' || column_name || ' is optional')
from unnest(array['group_id', 'memo', 'discovery_radius_m', 'deleted_at']) as column_name;
select col_is_pk('public', 'memory_photos', 'id', 'photo has its own primary key');
select col_is_pk('public', 'memory_posts', 'id', 'post has its own primary key');
select col_has_default('public', 'memory_photos', 'id', 'photo id is generated');
select col_has_default('public', 'memory_posts', 'id', 'post id is generated');
select col_has_default('public', 'memory_photos', 'created_at', 'photo creation time is generated');
select col_has_default('public', 'memory_posts', 'created_at', 'post creation time is generated');

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.memory_posts'::regclass
      and conname = 'memory_posts_photo_owner_fkey'
      and confrelid = 'public.memory_photos'::regclass
      and confdeltype = 'r'
  ),
  'photo references restrict physical deletion'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.memory_posts'::regclass
      and conname = 'memory_posts_group_id_fkey'
      and confrelid = 'public.groups'::regclass
      and confdeltype = 'r'
  ),
  'group physical deletion does not cascade to posts'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.memory_photos'::regclass
      and conname = 'memory_photos_owner_id_fkey'
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'r'
  ),
  'account deletion must explicitly handle its photos'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.memory_posts'::regclass
      and conname = 'memory_posts_author_id_fkey'
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'r'
  ),
  'account deletion does not silently cascade to posts'
);
select has_index('public', 'memory_photos', 'memory_photos_owner_id_idx', 'photo owner lookup is indexed');
select has_index('public', 'memory_posts', 'memory_posts_author_id_idx', 'post author lookup is indexed');
select has_index('public', 'memory_posts', 'memory_posts_group_id_idx', 'group lookup is indexed');
select has_index('public', 'memory_posts', 'memory_posts_photo_owner_idx', 'photo reference lookup is indexed');
select index_is_type('public', 'memory_posts', 'memory_posts_location_idx', 'gist', 'location lookup uses a spatial index');

-- Every fixture is synthetic; tests roll back all writes.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000901', 'memory-author@example.test'),
  ('00000000-0000-0000-0000-000000000902', 'memory-other@example.test');
insert into public.groups (id, name, created_by) values
  ('00000000-0000-0000-0000-000000000911', 'Memory fixtures', '00000000-0000-0000-0000-000000000901');
insert into public.memory_photos (id, owner_id, object_key) values
  ('00000000-0000-0000-0000-000000000921', '00000000-0000-0000-0000-000000000901', 'test/memory-a'),
  ('00000000-0000-0000-0000-000000000922', '00000000-0000-0000-0000-000000000902', 'test/memory-b');

-- Test-only helper keeps invalid input cases focused on the changed field.
create function pg_temp.insert_memory(
  p_kind text default 'personal',
  p_group_id uuid default null,
  p_radius integer default 0,
  p_photo_id uuid default '00000000-0000-0000-0000-000000000921',
  p_location geography default 'SRID=4326;POINT(0 0)'::geography
)
returns uuid language sql as $$
  insert into public.memory_posts (
    author_id, kind, group_id, photo_id, location, captured_at, discovery_radius_m
  ) values (
    '00000000-0000-0000-0000-000000000901', p_kind, p_group_id,
    p_photo_id, p_location, now(), p_radius
  ) returning id;
$$;

select lives_ok($$select pg_temp.insert_memory()$$, 'a private personal post is valid');
select lives_ok($$select pg_temp.insert_memory(p_radius := 500)$$, 'a 500m personal post is valid');
select lives_ok($$select pg_temp.insert_memory(p_radius := 1000)$$, 'a 1km personal post is valid');
select lives_ok(
  $$select pg_temp.insert_memory('group', '00000000-0000-0000-0000-000000000911', null)$$,
  'a group post has a group and no discovery radius'
);
select lives_ok(
  $$insert into public.memory_posts (author_id, kind, photo_id, location, captured_at)
    values ('00000000-0000-0000-0000-000000000901', 'personal',
      '00000000-0000-0000-0000-000000000921', 'SRID=4326;POINT(0 0)', now())$$,
  'a personal post can omit its radius'
);
select is(
  (select count(*) from public.memory_posts where discovery_radius_m = 0),
  2::bigint,
  'an omitted personal radius defaults to private'
);
select throws_ok($$select pg_temp.insert_memory(p_radius := 150)$$, '23514', null, 'legacy 150m radius is rejected');
select throws_ok($$select pg_temp.insert_memory(p_radius := -1)$$, '23514', null, 'negative radius is rejected');
select throws_ok($$select pg_temp.insert_memory(p_radius := 2000)$$, '23514', null, '2km radius is rejected');
select throws_ok($$select pg_temp.insert_memory(p_radius := null)$$, '23514', null, 'a personal post needs a radius');
select throws_ok(
  $$select pg_temp.insert_memory(p_group_id := '00000000-0000-0000-0000-000000000911')$$,
  '23514', null, 'a personal post cannot have a group destination'
);
select throws_ok($$select pg_temp.insert_memory('group', null, null)$$, '23514', null, 'a group post needs a destination');
select throws_ok(
  $$select pg_temp.insert_memory('group', '00000000-0000-0000-0000-000000000911', 0)$$,
  '23514', null, 'a group post cannot have a discovery radius'
);
select throws_ok($$select pg_temp.insert_memory(p_kind := 'public')$$, '23514', null, 'unknown post kind is rejected');
select throws_ok(
  $$select pg_temp.insert_memory('group', '00000000-0000-0000-0000-000000000999', null)$$,
  '23503', null, 'missing group is rejected'
);
select throws_ok(
  $$select pg_temp.insert_memory(p_photo_id := '00000000-0000-0000-0000-000000000999')$$,
  '23503', null, 'missing photo is rejected'
);
select throws_ok(
  $$select pg_temp.insert_memory(p_photo_id := '00000000-0000-0000-0000-000000000922')$$,
  '23503', null, 'another author cannot reuse a photo they do not own'
);
select throws_ok($$select pg_temp.insert_memory(p_photo_id := null)$$, '23502', null, 'a post needs a photo');
select throws_ok($$select pg_temp.insert_memory(p_location := null)$$, '23502', null, 'a post needs a capture point');
select throws_ok(
  $$select pg_temp.insert_memory(p_location := 'SRID=4326;POINT EMPTY')$$,
  '23514', null, 'an empty point is not a capture location'
);
select throws_ok(
  $$insert into public.memory_photos (owner_id, object_key)
    values ('00000000-0000-0000-0000-000000000901', '')$$,
  '23514', null, 'an empty file identifier is rejected'
);
select throws_ok(
  $$insert into public.memory_photos (owner_id, object_key)
    values ('00000000-0000-0000-0000-000000000901', '   ')$$,
  '23514', null, 'a blank file identifier is rejected'
);
select throws_ok(
  $$insert into public.memory_photos (owner_id, object_key)
    values ('00000000-0000-0000-0000-000000000902', 'test/memory-a')$$,
  '23505', null, 'one file cannot be registered as separate photo records'
);
select throws_ok(
  $$update public.memory_posts set deleted_at = created_at - interval '1 second'$$,
  '23514', null, 'deletion before creation is rejected'
);
select throws_ok(
  $$delete from public.memory_photos where id = '00000000-0000-0000-0000-000000000921'$$,
  '23503', null, 'a referenced photo cannot be physically removed'
);
select throws_ok(
  $$delete from public.groups where id = '00000000-0000-0000-0000-000000000911'$$,
  '23503', null, 'physical group deletion cannot erase posts by cascade'
);

-- A separate pair proves independent deletion without relying on unrelated posts.
insert into public.memory_photos (id, owner_id, object_key) values
  ('00000000-0000-0000-0000-000000000923', '00000000-0000-0000-0000-000000000901', 'test/shared');
insert into public.memory_posts (
  id, author_id, kind, group_id, photo_id, location, captured_at, discovery_radius_m, memo
) values
  ('00000000-0000-0000-0000-000000000941', '00000000-0000-0000-0000-000000000901',
   'personal', null, '00000000-0000-0000-0000-000000000923', 'SRID=4326;POINT(0 0)', now(), 500, 'Personal memory'),
  ('00000000-0000-0000-0000-000000000942', '00000000-0000-0000-0000-000000000901',
   'group', '00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000000923',
   'SRID=4326;POINT(0 0)', now(), null, 'Group memory');
select is(
  (select count(*) from public.memory_posts where photo_id = '00000000-0000-0000-0000-000000000923'),
  2::bigint, 'two independent posts share one photo'
);

update public.memory_posts set deleted_at = now()
where id = '00000000-0000-0000-0000-000000000941';
select is(
  (select memo from public.memory_posts where id = '00000000-0000-0000-0000-000000000942' and deleted_at is null),
  'Group memory', 'deleting the personal post preserves the group post'
);
select is(
  (select count(*) from public.memory_photos where id = '00000000-0000-0000-0000-000000000923'),
  1::bigint, 'the group post still has its photo'
);

-- Reverse direction: test-only privileged reset, not a product restoration feature.
update public.memory_posts set deleted_at = null
where id = '00000000-0000-0000-0000-000000000941';
update public.memory_posts set deleted_at = now()
where id = '00000000-0000-0000-0000-000000000942';
select is(
  (select memo from public.memory_posts where id = '00000000-0000-0000-0000-000000000941' and deleted_at is null),
  'Personal memory', 'deleting the group post preserves the personal post'
);
select is(
  (select count(*) from public.memory_photos where id = '00000000-0000-0000-0000-000000000923'),
  1::bigint, 'the personal post still has its photo'
);

update public.memory_posts set deleted_at = null
where id = '00000000-0000-0000-0000-000000000942';
update public.groups set dissolved_at = now()
where id = '00000000-0000-0000-0000-000000000911';
select is(
  (select memo from public.memory_posts where id = '00000000-0000-0000-0000-000000000941' and deleted_at is null),
  'Personal memory', 'group dissolution preserves the independent personal post'
);
select is(
  (select count(*) from public.memory_photos where id = '00000000-0000-0000-0000-000000000923'),
  1::bigint, 'group dissolution does not erase a shared photo'
);

-- This is the future cleanup eligibility contract, not an implemented cleanup worker.
select is(
  (select count(*) from public.memory_posts as posts
   left join public.groups as groups on groups.id = posts.group_id
   where posts.photo_id = '00000000-0000-0000-0000-000000000923'
     and posts.deleted_at is null
     and (posts.kind = 'personal' or groups.dissolved_at is null)),
  1::bigint, 'an active personal post keeps the shared photo in use after dissolution'
);
update public.memory_posts set deleted_at = now()
where id = '00000000-0000-0000-0000-000000000941';
select is(
  (select count(*) from public.memory_posts as posts
   left join public.groups as groups on groups.id = posts.group_id
   where posts.photo_id = '00000000-0000-0000-0000-000000000923'
     and posts.deleted_at is null
     and (posts.kind = 'personal' or groups.dissolved_at is null)),
  0::bigint, 'a dissolved group and a deleted personal post are not active references'
);
select throws_ok(
  $$delete from public.memory_photos where id = '00000000-0000-0000-0000-000000000923'$$,
  '23503', null, 'historical post references need an explicit metadata cleanup procedure'
);
delete from public.memory_posts where id = '00000000-0000-0000-0000-000000000941';
select is(
  (select count(*) from public.memory_posts where id = '00000000-0000-0000-0000-000000000942'),
  1::bigint, 'physical deletion of one post does not cascade to its counterpart'
);
select is(
  (select count(*) from public.memory_photos where id = '00000000-0000-0000-0000-000000000923'),
  1::bigint, 'physical deletion of one post does not cascade to its photo'
);

select * from finish();
rollback;
