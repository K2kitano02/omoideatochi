begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000002401', 'lifecycle-owner@example.test'),
  ('00000000-0000-0000-0000-000000002402', 'lifecycle-member@example.test'),
  ('00000000-0000-0000-0000-000000002403', 'lifecycle-target@example.test'),
  ('00000000-0000-0000-0000-000000002404', 'lifecycle-outsider@example.test'),
  ('00000000-0000-0000-0000-000000002405', 'lifecycle-other-owner@example.test'),
  ('00000000-0000-0000-0000-000000002406', 'lifecycle-applicant@example.test'),
  ('00000000-0000-0000-0000-000000002407', 'lifecycle-limit-owner@example.test');

insert into public.groups (id, name, created_by)
values
  ('24000000-0000-0000-0000-000000000001', 'Leave group', '00000000-0000-0000-0000-000000002401'),
  ('24000000-0000-0000-0000-000000000002', 'Remove group', '00000000-0000-0000-0000-000000002401'),
  ('24000000-0000-0000-0000-000000000003', 'Dissolve group', '00000000-0000-0000-0000-000000002401'),
  ('24000000-0000-0000-0000-000000000004', 'Other group', '00000000-0000-0000-0000-000000002405'),
  ('24000000-0000-0000-0000-000000000011', 'Limit one', '00000000-0000-0000-0000-000000002407'),
  ('24000000-0000-0000-0000-000000000012', 'Limit two', '00000000-0000-0000-0000-000000002407'),
  ('24000000-0000-0000-0000-000000000013', 'Limit three', '00000000-0000-0000-0000-000000002407'),
  ('24000000-0000-0000-0000-000000000014', 'Limit four', '00000000-0000-0000-0000-000000002407'),
  ('24000000-0000-0000-0000-000000000015', 'Limit five', '00000000-0000-0000-0000-000000002407');

insert into public.group_members (group_id, user_id)
values
  ('24000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000002401'),
  ('24000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000002402'),
  ('24000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000002401'),
  ('24000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000002403'),
  ('24000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000002401'),
  ('24000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000002402'),
  ('24000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000002405'),
  ('24000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000002404'),
  ('24000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000002407'),
  ('24000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000002407'),
  ('24000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000002407'),
  ('24000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000002407'),
  ('24000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000002407');

insert into public.group_invitations (
  id,
  group_id,
  issued_by,
  token_hash,
  requires_approval
)
values
  ('24100000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000002402', extensions.digest('leave-member', 'sha256'), true),
  ('24100000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000002401', extensions.digest('leave-owner', 'sha256'), false),
  ('24100000-0000-0000-0000-000000000003', '24000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000002403', extensions.digest('remove-member', 'sha256'), true),
  ('24100000-0000-0000-0000-000000000004', '24000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000002401', extensions.digest('dissolve-owner', 'sha256'), false),
  ('24100000-0000-0000-0000-000000000005', '24000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000002405', extensions.digest('other-owner', 'sha256'), false);

insert into public.group_join_requests (
  id,
  group_id,
  invitation_id,
  applicant_id
)
values
  ('24200000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', '24100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000002402'),
  ('24200000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000002', '24100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000002403'),
  ('24200000-0000-0000-0000-000000000003', '24000000-0000-0000-0000-000000000003', '24100000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000002406'),
  ('24200000-0000-0000-0000-000000000004', '24000000-0000-0000-0000-000000000004', '24100000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000002406');

select has_function('public', 'leave_group', array['uuid'], 'leave RPC exists');
select has_function('public', 'remove_group_member', array['uuid', 'uuid'], 'member removal RPC exists');
select has_function('public', 'dissolve_group', array['uuid'], 'dissolution RPC exists');

select ok(
  coalesce(has_function_privilege('authenticated', to_regprocedure('public.leave_group(uuid)'), 'EXECUTE'), false),
  'authenticated users can execute the leave RPC'
);
select ok(
  not coalesce(has_function_privilege('anon', to_regprocedure('public.leave_group(uuid)'), 'EXECUTE'), false),
  'anonymous users cannot execute the leave RPC'
);
select ok(
  coalesce(has_function_privilege('authenticated', to_regprocedure('public.remove_group_member(uuid, uuid)'), 'EXECUTE'), false),
  'authenticated users can execute the member removal RPC'
);
select ok(
  not coalesce(has_function_privilege('anon', to_regprocedure('public.remove_group_member(uuid, uuid)'), 'EXECUTE'), false),
  'anonymous users cannot execute the member removal RPC'
);
select ok(
  coalesce(has_function_privilege('authenticated', to_regprocedure('public.dissolve_group(uuid)'), 'EXECUTE'), false),
  'authenticated users can execute the dissolution RPC'
);
select ok(
  not coalesce(has_function_privilege('anon', to_regprocedure('public.dissolve_group(uuid)'), 'EXECUTE'), false),
  'anonymous users cannot execute the dissolution RPC'
);
select is(
  (
    select count(*)::integer
    from pg_proc
    where oid in (
      to_regprocedure('public.leave_group(uuid)'),
      to_regprocedure('public.remove_group_member(uuid, uuid)'),
      to_regprocedure('public.dissolve_group(uuid)')
    )
      and prosecdef
      and 'search_path=""' = any(proconfig)
  ),
  3,
  'all lifecycle RPCs are security definer functions with an empty search path'
);
select is(
  (
    select count(*)::integer
    from unnest(
      array[
        to_regprocedure('public.leave_group(uuid)'),
        to_regprocedure('public.remove_group_member(uuid, uuid)'),
        to_regprocedure('public.dissolve_group(uuid)')
      ]
    ) as rpc(oid)
    where has_function_privilege('service_role', rpc.oid, 'EXECUTE')
  ),
  0,
  'service role cannot execute lifecycle RPCs directly'
);

set local role anon;
select throws_ok(
  $$select public.leave_group('24000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'anonymous users cannot call the leave RPC'
);
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok(
  $$select public.leave_group('24000000-0000-0000-0000-000000000001')$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot leave a group'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002401', true);
set local role authenticated;
select throws_ok(
  $$select public.leave_group('24000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'owner_cannot_leave',
  'the owner cannot leave their group'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002404', true);
set local role authenticated;
select throws_ok(
  $$select public.leave_group('24000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'member_not_found',
  'a non-member cannot leave a group'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002402', true);
set local role authenticated;
select lives_ok(
  $$select public.leave_group('24000000-0000-0000-0000-000000000001')$$,
  'a regular member can leave their group'
);
select throws_ok(
  $$select public.leave_group('24000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'member_not_found',
  'leaving twice reports that the membership no longer exists'
);
select is(
  (select count(*)::integer from public.groups where id = '24000000-0000-0000-0000-000000000001'),
  0,
  'a former member can no longer read the group through RLS'
);
reset role;

select is(
  (select count(*)::integer from public.group_members where group_id = '24000000-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-000000002402'),
  0,
  'leaving removes the membership'
);
select is(
  (select count(*)::integer from public.group_invitations where id = '24100000-0000-0000-0000-000000000001'),
  0,
  'leaving invalidates invitations issued by the former member'
);
select is(
  (select count(*)::integer from public.group_invitations where id = '24100000-0000-0000-0000-000000000002'),
  1,
  'leaving preserves invitations issued by other members'
);
select is(
  (select status from public.group_join_requests where id = '24200000-0000-0000-0000-000000000001'),
  'cancelled',
  'leaving cancels the former member pending request'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002403', true);
set local role authenticated;
select throws_ok(
  $$select public.remove_group_member('24000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000002401')$$,
  '42501',
  'permission_denied',
  'a regular member cannot remove another member'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002401', true);
set local role authenticated;
select throws_ok(
  $$select public.remove_group_member('24000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000002401')$$,
  'P0001',
  'owner_cannot_be_removed',
  'the owner cannot remove themselves'
);
select lives_ok(
  $$select public.remove_group_member('24000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000002403')$$,
  'the owner can remove a regular member'
);
select throws_ok(
  $$select public.remove_group_member('24000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000002403')$$,
  'P0001',
  'member_not_found',
  'removing a member twice reports that the membership no longer exists'
);
reset role;

select is(
  (select count(*)::integer from public.group_members where group_id = '24000000-0000-0000-0000-000000000002' and user_id = '00000000-0000-0000-0000-000000002403'),
  0,
  'member removal deletes the target membership'
);
select is(
  (select count(*)::integer from public.group_invitations where id = '24100000-0000-0000-0000-000000000003'),
  0,
  'member removal invalidates invitations issued by the target'
);
select is(
  (select status from public.group_join_requests where id = '24200000-0000-0000-0000-000000000002'),
  'cancelled',
  'member removal cancels the target pending request'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002402', true);
set local role authenticated;
select throws_ok(
  $$select public.dissolve_group('24000000-0000-0000-0000-000000000003')$$,
  '42501',
  'permission_denied',
  'a regular member cannot dissolve the group'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002401', true);
set local role authenticated;
select lives_ok(
  $$select public.dissolve_group('24000000-0000-0000-0000-000000000003')$$,
  'the owner can dissolve the group'
);
select throws_ok(
  $$select public.dissolve_group('24000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'group_dissolved',
  'dissolving twice reports the existing dissolved state'
);
select is(
  (select count(*)::integer from public.groups where id = '24000000-0000-0000-0000-000000000003'),
  0,
  'the owner can no longer read a dissolved group through RLS'
);
reset role;

select ok(
  (select dissolved_at is not null from public.groups where id = '24000000-0000-0000-0000-000000000003'),
  'dissolution records when the group was dissolved'
);
select is(
  (select count(*)::integer from public.group_members where group_id = '24000000-0000-0000-0000-000000000003'),
  0,
  'dissolution removes every membership'
);
select is(
  (select count(*)::integer from public.group_invitations where group_id = '24000000-0000-0000-0000-000000000003'),
  0,
  'dissolution invalidates every invitation'
);
select is(
  (select status from public.group_join_requests where id = '24200000-0000-0000-0000-000000000003'),
  'cancelled',
  'dissolution cancels every pending request'
);
select is(
  (select count(*)::integer from public.group_members where group_id = '24000000-0000-0000-0000-000000000004'),
  2,
  'dissolution does not change another group memberships'
);
select is(
  (select status from public.group_join_requests where id = '24200000-0000-0000-0000-000000000004'),
  'pending',
  'dissolution does not change another group pending requests'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000002407', true);
set local role authenticated;
select lives_ok(
  $$select public.dissolve_group('24000000-0000-0000-0000-000000000011')$$,
  'the limit owner can dissolve one of five active groups'
);
select lives_ok(
  $$select public.create_group('Replacement group')$$,
  'a dissolved group no longer consumes the five-group creation limit'
);
reset role;

select * from finish();
rollback;
