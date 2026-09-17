begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000201', 'group-owner@example.test'),
  ('00000000-0000-0000-0000-000000000202', 'other-owner@example.test'),
  ('00000000-0000-0000-0000-000000000203', 'whitespace-owner@example.test');

select has_function('public', 'create_group', array['text'], 'group creation RPC exists');
select ok(
  coalesce(
    has_function_privilege('authenticated', to_regprocedure('public.create_group(text)'), 'EXECUTE'),
    false
  ),
  'authenticated users can execute the group creation RPC'
);
select ok(
  not coalesce(
    has_function_privilege('anon', to_regprocedure('public.create_group(text)'), 'EXECUTE'),
    false
  ),
  'anonymous users cannot execute the group creation RPC'
);

set local role anon;
select throws_ok(
  $$select public.create_group('家族')$$,
  '42501',
  null,
  'anonymous users cannot create a group'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select public.create_group('家族')$$,
  '28000',
  null,
  'a missing user ID is rejected'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000203', true);
set local role authenticated;
select throws_ok(
  $$select public.create_group(E'\t家族\t')$$,
  '22023',
  null,
  'a name surrounded by tabs is rejected'
);
select throws_ok(
  $$select public.create_group(E'\n家族\n')$$,
  '22023',
  null,
  'a name surrounded by newlines is rejected'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
set local role authenticated;
select lives_ok(
  $$select public.create_group('家族')$$,
  'an authenticated user can create a group'
);
select throws_ok(
  $$insert into public.groups (name, created_by) values ('直書き', '00000000-0000-0000-0000-000000000201')$$,
  '42501',
  null,
  'an authenticated user cannot bypass the RPC with a direct insert'
);
reset role;

select is(
  (select count(*)::integer from public.groups where created_by = '00000000-0000-0000-0000-000000000201'),
  1,
  'group creation stores the caller as owner'
);
select is(
  (
    select count(*)::integer
    from public.group_members as gm
    join public.groups as g on g.id = gm.group_id
    where g.created_by = '00000000-0000-0000-0000-000000000201'
      and gm.user_id = g.created_by
  ),
  1,
  'group creation also registers the owner as a member'
);

set local role authenticated;
select throws_ok($$select public.create_group('')$$, '22023', null, 'an empty name is rejected');
select throws_ok(
  $$select public.create_group(' 家族 ')$$,
  '22023',
  null,
  'a name with surrounding whitespace is rejected'
);
select throws_ok(
  $$select public.create_group(repeat('a', 101))$$,
  '22023',
  null,
  'a name longer than 100 characters is rejected'
);

select lives_ok($$select public.create_group('友達')$$, 'the second group can be created');
select lives_ok($$select public.create_group('旅行')$$, 'the third group can be created');
select lives_ok($$select public.create_group('学校')$$, 'the fourth group can be created');
select lives_ok($$select public.create_group('趣味')$$, 'the fifth group can be created');
select throws_ok(
  $$select public.create_group('六つ目')$$,
  '22023',
  null,
  'the sixth group is rejected'
);
reset role;

select is(
  (select count(*)::integer from public.groups where created_by = '00000000-0000-0000-0000-000000000201'),
  5,
  'the sixth request leaves the owner with five groups'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
set local role authenticated;
select lives_ok(
  $$select public.create_group('別の家族')$$,
  'a different user has an independent group limit'
);
reset role;
select is(
  (select count(*)::integer from public.groups where created_by = '00000000-0000-0000-0000-000000000202'),
  1,
  'a different user owns their own group'
);

create function pg_temp.reject_group_member()
returns trigger
language plpgsql
as $$
begin
  raise exception 'membership insert blocked for atomicity test';
end;
$$;

create trigger reject_group_member_for_test
before insert on public.group_members
for each row execute function pg_temp.reject_group_member();

set local role authenticated;
select throws_ok(
  $$select public.create_group('途中失敗')$$,
  'P0001',
  null,
  'a membership insert failure rejects the whole creation'
);
reset role;
select is(
  (select count(*)::integer from public.groups where created_by = '00000000-0000-0000-0000-000000000202'),
  1,
  'a failed membership insert leaves no orphan group'
);

select * from finish();
rollback;
