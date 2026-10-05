begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(relrowsecurity, table_name || ' has RLS enabled')
from (values ('memory_photos'), ('memory_posts')) as tables(table_name)
join pg_class on oid = ('public.' || table_name)::regclass;

select ok(
  (select count(*) = 0
   from pg_policy where polrelid = 'public.memory_photos'::regclass),
  'photos have no client access policy'
);
select ok(
  exists (
    select 1 from pg_policy
    where polrelid = 'public.memory_posts'::regclass
      and polname = 'memory_posts_select_author_or_member'
      and polcmd = 'r'
  ),
  'posts have a read-only author or current member policy'
);

select ok(
  not has_table_privilege(role_name, 'public.' || table_name, privilege_name),
  role_name || ' has no ' || privilege_name || ' privilege on ' || table_name
)
from (values ('anon'), ('authenticated')) as roles(role_name)
cross join (values ('memory_photos'), ('memory_posts')) as tables(table_name)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as privileges(privilege_name);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000931', 'memory-access@example.test');
insert into public.memory_photos (id, owner_id, object_key) values
  ('00000000-0000-0000-0000-000000000932', '00000000-0000-0000-0000-000000000931', 'test/access');
insert into public.memory_posts (author_id, kind, photo_id, location, captured_at) values
  ('00000000-0000-0000-0000-000000000931', 'personal', '00000000-0000-0000-0000-000000000932', 'SRID=4326;POINT(0 0)', now());

-- Exercise real statements as anonymous and authenticated (even the owner).
set local role anon;
select throws_ok($$select * from public.memory_photos$$, '42501', null, 'anonymous photo reads are denied');
select throws_ok($$select * from public.memory_posts$$, '42501', null, 'anonymous post reads are denied');
select throws_ok($$insert into public.memory_photos (owner_id, object_key) values ('00000000-0000-0000-0000-000000000931', 'test/anon')$$, '42501', null, 'anonymous photo creation is denied');
select throws_ok($$insert into public.memory_posts (author_id, kind, photo_id, location, captured_at) values ('00000000-0000-0000-0000-000000000931', 'personal', '00000000-0000-0000-0000-000000000932', 'SRID=4326;POINT(0 0)', now())$$, '42501', null, 'anonymous post creation is denied');
select throws_ok($$update public.memory_photos set object_key = 'test/changed'$$, '42501', null, 'anonymous photo updates are denied');
select throws_ok($$update public.memory_posts set memo = 'changed'$$, '42501', null, 'anonymous post updates are denied');
select throws_ok($$delete from public.memory_photos$$, '42501', null, 'anonymous photo deletion is denied');
select throws_ok($$delete from public.memory_posts$$, '42501', null, 'anonymous post deletion is denied');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000931', true);
set local role authenticated;
select throws_ok($$select * from public.memory_photos$$, '42501', null, 'authenticated photo reads await authorized RPCs');
select throws_ok($$select * from public.memory_posts$$, '42501', null, 'authenticated post reads await authorized RPCs');
select throws_ok($$insert into public.memory_photos (owner_id, object_key) values ('00000000-0000-0000-0000-000000000931', 'test/authenticated')$$, '42501', null, 'authenticated photo creation is denied');
select throws_ok($$insert into public.memory_posts (author_id, kind, photo_id, location, captured_at) values ('00000000-0000-0000-0000-000000000931', 'personal', '00000000-0000-0000-0000-000000000932', 'SRID=4326;POINT(0 0)', now())$$, '42501', null, 'authenticated post creation is denied');
select throws_ok($$update public.memory_photos set object_key = 'test/changed'$$, '42501', null, 'authenticated photo updates are denied');
select throws_ok($$update public.memory_posts set memo = 'changed'$$, '42501', null, 'authenticated post updates are denied');
select throws_ok($$delete from public.memory_photos$$, '42501', null, 'authenticated photo deletion is denied');
select throws_ok($$delete from public.memory_posts$$, '42501', null, 'authenticated post deletion is denied');
reset role;

-- Defense in depth: granting SELECT here still allows only authorized posts.
grant select on public.memory_photos, public.memory_posts to authenticated;
set local role authenticated;
select is((select count(*) from public.memory_photos), 0::bigint, 'RLS hides photos even if SELECT is accidentally granted');
select is((select count(*) from public.memory_posts), 1::bigint, 'RLS permits only the owner personal post if SELECT is granted');
reset role;

select * from finish();
rollback;
