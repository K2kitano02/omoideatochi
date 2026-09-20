begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

select has_table(
  'public',
  'group_invitations',
  'group_invitations table exists'
);
select has_table(
  'public',
  'group_join_requests',
  'group_join_requests table exists'
);

select columns_are(
  'public',
  'group_invitations',
  array[
    'id',
    'group_id',
    'issued_by',
    'token_hash',
    'requires_approval',
    'created_at',
    'expires_at',
    'used_at',
    'used_by'
  ],
  'group_invitations has only the expected columns'
);
select columns_are(
  'public',
  'group_join_requests',
  array[
    'id',
    'group_id',
    'invitation_id',
    'applicant_id',
    'status',
    'created_at',
    'resolved_at',
    'resolved_by'
  ],
  'group_join_requests has only the expected columns'
);

select col_type_is('public', 'group_invitations', 'id', 'uuid', 'invitation id is uuid');
select col_type_is('public', 'group_invitations', 'group_id', 'uuid', 'invitation group id is uuid');
select col_type_is('public', 'group_invitations', 'issued_by', 'uuid', 'invitation issuer is uuid');
select col_type_is('public', 'group_invitations', 'token_hash', 'bytea', 'token hash is binary');
select col_type_is(
  'public',
  'group_invitations',
  'requires_approval',
  'boolean',
  'approval requirement is boolean'
);
select col_type_is(
  'public',
  'group_invitations',
  'created_at',
  'timestamp with time zone',
  'invitation creation time is timezone-aware'
);
select col_type_is(
  'public',
  'group_invitations',
  'expires_at',
  'timestamp with time zone',
  'invitation expiration time is timezone-aware'
);
select col_type_is(
  'public',
  'group_invitations',
  'used_at',
  'timestamp with time zone',
  'invitation use time is timezone-aware'
);
select col_type_is('public', 'group_invitations', 'used_by', 'uuid', 'invitation user is uuid');

select col_type_is('public', 'group_join_requests', 'id', 'uuid', 'join request id is uuid');
select col_type_is('public', 'group_join_requests', 'group_id', 'uuid', 'join request group id is uuid');
select col_type_is(
  'public',
  'group_join_requests',
  'invitation_id',
  'uuid',
  'join request invitation id is uuid'
);
select col_type_is(
  'public',
  'group_join_requests',
  'applicant_id',
  'uuid',
  'join request applicant is uuid'
);
select col_type_is('public', 'group_join_requests', 'status', 'text', 'join request status is text');
select col_type_is(
  'public',
  'group_join_requests',
  'created_at',
  'timestamp with time zone',
  'join request creation time is timezone-aware'
);
select col_type_is(
  'public',
  'group_join_requests',
  'resolved_at',
  'timestamp with time zone',
  'join request resolution time is timezone-aware'
);
select col_type_is('public', 'group_join_requests', 'resolved_by', 'uuid', 'join request resolver is uuid');

select col_not_null('public', 'group_invitations', 'id', 'invitation id is required');
select col_not_null('public', 'group_invitations', 'group_id', 'invitation group is required');
select col_not_null('public', 'group_invitations', 'issued_by', 'invitation issuer is required');
select col_not_null('public', 'group_invitations', 'token_hash', 'token hash is required');
select col_not_null(
  'public',
  'group_invitations',
  'requires_approval',
  'approval requirement is required'
);
select col_not_null('public', 'group_invitations', 'created_at', 'invitation creation time is required');
select col_not_null('public', 'group_invitations', 'expires_at', 'invitation expiration time is required');
select col_is_null('public', 'group_invitations', 'used_at', 'unused invitation has no use time');
select col_is_null('public', 'group_invitations', 'used_by', 'unused invitation has no user');

select col_not_null('public', 'group_join_requests', 'id', 'join request id is required');
select col_not_null('public', 'group_join_requests', 'group_id', 'join request group is required');
select col_is_null(
  'public',
  'group_join_requests',
  'invitation_id',
  'invitation reference can be cleared after issuer deletion'
);
select col_not_null('public', 'group_join_requests', 'applicant_id', 'join request applicant is required');
select col_not_null('public', 'group_join_requests', 'status', 'join request status is required');
select col_not_null('public', 'group_join_requests', 'created_at', 'join request creation time is required');
select col_is_null('public', 'group_join_requests', 'resolved_at', 'pending request has no resolution time');
select col_is_null('public', 'group_join_requests', 'resolved_by', 'pending request has no resolver');

select col_has_default('public', 'group_invitations', 'id', 'invitation id has a default');
select col_has_default('public', 'group_invitations', 'created_at', 'invitation creation time has a default');
select col_has_default('public', 'group_invitations', 'expires_at', 'invitation expiration time has a default');
select col_has_default('public', 'group_join_requests', 'id', 'join request id has a default');
select col_has_default('public', 'group_join_requests', 'status', 'join request status has a default');
select col_has_default('public', 'group_join_requests', 'created_at', 'join request creation time has a default');

select col_is_pk('public', 'group_invitations', 'id', 'invitation id is the primary key');
select col_is_pk('public', 'group_join_requests', 'id', 'join request id is the primary key');

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'group_invitations_group_id_fkey'
      and conrelid = 'public.group_invitations'::regclass
      and confrelid = 'public.groups'::regclass
      and confdeltype = 'c'
  ),
  'group deletion cascades to invitations'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'group_invitations_issuer_membership_fkey'
      and conrelid = 'public.group_invitations'::regclass
      and confrelid = 'public.group_members'::regclass
      and confdeltype = 'c'
  ),
  'issuer must be a current member and membership deletion removes invitations'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'group_invitations_used_by_fkey'
      and conrelid = 'public.group_invitations'::regclass
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ),
  'used invitation does not block user account deletion'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'group_join_requests_group_id_fkey'
      and conrelid = 'public.group_join_requests'::regclass
      and confrelid = 'public.groups'::regclass
      and confdeltype = 'c'
  ),
  'group deletion cascades to join requests'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'group_join_requests_invitation_group_fkey'
      and conrelid = 'public.group_join_requests'::regclass
      and confrelid = 'public.group_invitations'::regclass
      and confdeltype = 'n'
  ),
  'invitation deletion preserves a submitted request'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'group_join_requests_applicant_id_fkey'
      and conrelid = 'public.group_join_requests'::regclass
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ),
  'applicant deletion removes their join requests'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'group_join_requests_resolved_by_fkey'
      and conrelid = 'public.group_join_requests'::regclass
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ),
  'resolver deletion does not block account deletion'
);

select has_index(
  'public',
  'group_invitations',
  'group_invitations_group_active_idx',
  'active invitations can be found by group and expiration'
);
select has_index(
  'public',
  'group_invitations',
  'group_invitations_issuer_idx',
  'issuer membership cascade is indexed'
);
select has_index(
  'public',
  'group_invitations',
  'group_invitations_used_by_idx',
  'used-by account cascade is indexed'
);
select has_index(
  'public',
  'group_join_requests',
  'group_join_requests_invitation_id_idx',
  'invitation deletion is indexed'
);
select has_index(
  'public',
  'group_join_requests',
  'group_join_requests_applicant_id_idx',
  'applicant account cascade is indexed'
);
select has_index(
  'public',
  'group_join_requests',
  'group_join_requests_resolved_by_idx',
  'resolver account cascade is indexed'
);
select has_index(
  'public',
  'group_join_requests',
  'group_join_requests_group_pending_idx',
  'pending requests can be listed by group and creation time'
);
select has_index(
  'public',
  'group_join_requests',
  'group_join_requests_one_pending_per_applicant_idx',
  'one pending request per applicant and group is indexed'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.group_invitations'::regclass),
  'group_invitations has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.group_join_requests'::regclass),
  'group_join_requests has row level security enabled'
);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000501', 'invite-owner@example.test'),
  ('00000000-0000-0000-0000-000000000502', 'invite-member@example.test'),
  ('00000000-0000-0000-0000-000000000503', 'invite-applicant@example.test'),
  ('00000000-0000-0000-0000-000000000504', 'invite-resolver@example.test'),
  ('00000000-0000-0000-0000-000000000505', 'invite-second-applicant@example.test'),
  ('00000000-0000-0000-0000-000000000506', 'invite-used-by@example.test'),
  ('00000000-0000-0000-0000-000000000507', 'invite-leaving-member@example.test'),
  ('00000000-0000-0000-0000-000000000508', 'invite-leaver-applicant@example.test'),
  ('00000000-0000-0000-0000-000000000509', 'invite-second-owner@example.test');

insert into public.groups (id, name, created_by)
values
  (
    '50000000-0000-0000-0000-000000000501',
    'Invitation test group',
    '00000000-0000-0000-0000-000000000501'
  ),
  (
    '50000000-0000-0000-0000-000000000502',
    'Second invitation group',
    '00000000-0000-0000-0000-000000000509'
  );

insert into public.group_members (group_id, user_id)
values
  ('50000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000501'),
  ('50000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000502'),
  ('50000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000507'),
  ('50000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000509');

select throws_ok(
  $$
    insert into public.group_invitations (
      group_id, issued_by, token_hash, requires_approval
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000503',
      decode(repeat('01', 32), 'hex'),
      true
    )
  $$,
  '23503',
  null,
  'a non-member cannot be stored as an invitation issuer'
);

select lives_ok(
  $$
    insert into public.group_invitations (
      id, group_id, issued_by, token_hash, requires_approval, created_at, expires_at
    ) values (
      '51000000-0000-0000-0000-000000000501',
      '50000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000502',
      decode(repeat('02', 32), 'hex'),
      true,
      '2026-09-20 00:00:00+00',
      '2026-09-20 00:10:00+00'
    )
  $$,
  'a valid invitation stores a 32-byte token hash'
);

select throws_ok(
  $$
    insert into public.group_invitations (
      group_id, issued_by, token_hash, requires_approval
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000502',
      decode(repeat('02', 32), 'hex'),
      true
    )
  $$,
  '23505',
  null,
  'the same token hash cannot be stored twice'
);

select throws_ok(
  $$
    insert into public.group_invitations (
      group_id, issued_by, token_hash, requires_approval
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000502',
      decode(repeat('03', 31), 'hex'),
      true
    )
  $$,
  '23514',
  null,
  'a token hash must contain exactly 32 bytes'
);

select throws_ok(
  $$
    insert into public.group_invitations (
      group_id, issued_by, token_hash, requires_approval, created_at, expires_at
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000502',
      decode(repeat('04', 32), 'hex'),
      true,
      '2026-09-20 00:00:00+00',
      '2026-09-20 00:09:59+00'
    )
  $$,
  '23514',
  null,
  'an invitation expires exactly ten minutes after creation'
);

select throws_ok(
  $$
    insert into public.group_invitations (
      group_id, issued_by, token_hash, requires_approval, used_by
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000502',
      decode(repeat('05', 32), 'hex'),
      true,
      '00000000-0000-0000-0000-000000000506'
    )
  $$,
  '23514',
  null,
  'an unused invitation cannot have a user'
);

select throws_ok(
  $$
    insert into public.group_invitations (
      group_id, issued_by, token_hash, requires_approval, used_at
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000502',
      decode(repeat('06', 32), 'hex'),
      true,
      now()
    )
  $$,
  '23514',
  null,
  'a used invitation must identify its user'
);

select throws_ok(
  $$
    insert into public.group_invitations (
      group_id, issued_by, token_hash, requires_approval,
      created_at, expires_at, used_at, used_by
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000502',
      decode(repeat('07', 32), 'hex'),
      true,
      '2026-09-20 00:00:00+00',
      '2026-09-20 00:10:00+00',
      '2026-09-20 00:10:01+00',
      '00000000-0000-0000-0000-000000000506'
    )
  $$,
  '23514',
  null,
  'an invitation cannot be marked used after expiration'
);

select lives_ok(
  $$
    insert into public.group_invitations (
      id, group_id, issued_by, token_hash, requires_approval,
      created_at, expires_at, used_at, used_by
    ) values (
      '51000000-0000-0000-0000-000000000502',
      '50000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000502',
      decode(repeat('08', 32), 'hex'),
      true,
      '2026-09-20 00:00:00+00',
      '2026-09-20 00:10:00+00',
      '2026-09-20 00:05:00+00',
      '00000000-0000-0000-0000-000000000506'
    )
  $$,
  'an invitation can be marked used during its valid period'
);

select lives_ok(
  $$
    insert into public.group_join_requests (
      id, group_id, invitation_id, applicant_id
    ) values (
      '52000000-0000-0000-0000-000000000501',
      '50000000-0000-0000-0000-000000000501',
      '51000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000503'
    )
  $$,
  'a pending join request can be stored'
);

select is(
  (
    select status
    from public.group_join_requests
    where id = '52000000-0000-0000-0000-000000000501'
  ),
  'pending',
  'a new join request defaults to pending'
);

select throws_ok(
  $$
    insert into public.group_join_requests (
      group_id, invitation_id, applicant_id
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '51000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000503'
    )
  $$,
  '23505',
  null,
  'an applicant cannot have two pending requests for one group'
);

select throws_ok(
  $$
    insert into public.group_join_requests (
      group_id, invitation_id, applicant_id, status
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '51000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000505',
      'unknown'
    )
  $$,
  '23514',
  null,
  'an unknown join request status is rejected'
);

select throws_ok(
  $$
    insert into public.group_join_requests (
      group_id, invitation_id, applicant_id, status, resolved_at
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '51000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000505',
      'pending',
      now()
    )
  $$,
  '23514',
  null,
  'a pending request cannot contain resolution details'
);

select throws_ok(
  $$
    insert into public.group_join_requests (
      group_id, invitation_id, applicant_id, status, resolved_at
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '51000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000505',
      'approved',
      now()
    )
  $$,
  '23514',
  null,
  'an approved request must identify its resolver'
);

select throws_ok(
  $$
    insert into public.group_join_requests (
      group_id, invitation_id, applicant_id,
      status, created_at, resolved_at, resolved_by
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '51000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000505',
      'rejected',
      '2026-09-20 00:05:00+00',
      '2026-09-20 00:04:59+00',
      '00000000-0000-0000-0000-000000000504'
    )
  $$,
  '23514',
  null,
  'a request cannot be resolved before it was created'
);

select lives_ok(
  $$
    insert into public.group_join_requests (
      group_id, invitation_id, applicant_id,
      status, resolved_at, resolved_by
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '51000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000505',
      'rejected',
      now(),
      '00000000-0000-0000-0000-000000000504'
    )
  $$,
  'a rejected request stores its resolver and resolution time'
);

select lives_ok(
  $$
    insert into public.group_join_requests (
      group_id, invitation_id, applicant_id, status, resolved_at
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '51000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000505',
      'cancelled',
      now()
    )
  $$,
  'a cancelled request does not require a resolver'
);

update public.group_join_requests
set
  status = 'rejected',
  resolved_at = now(),
  resolved_by = '00000000-0000-0000-0000-000000000501'
where id = '52000000-0000-0000-0000-000000000501';

insert into public.group_invitations (
  id, group_id, issued_by, token_hash, requires_approval
) values (
  '51000000-0000-0000-0000-000000000503',
  '50000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000502',
  decode(repeat('09', 32), 'hex'),
  true
);

select lives_ok(
  $$
    insert into public.group_join_requests (
      group_id, invitation_id, applicant_id
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '51000000-0000-0000-0000-000000000503',
      '00000000-0000-0000-0000-000000000503'
    )
  $$,
  'an applicant can request again after rejection'
);

insert into public.group_invitations (
  id, group_id, issued_by, token_hash, requires_approval
) values (
  '51000000-0000-0000-0000-000000000504',
  '50000000-0000-0000-0000-000000000502',
  '00000000-0000-0000-0000-000000000509',
  decode(repeat('0a', 32), 'hex'),
  false
);

select throws_ok(
  $$
    insert into public.group_join_requests (
      group_id, invitation_id, applicant_id
    ) values (
      '50000000-0000-0000-0000-000000000501',
      '51000000-0000-0000-0000-000000000504',
      '00000000-0000-0000-0000-000000000508'
    )
  $$,
  '23503',
  null,
  'a join request cannot reference an invitation for another group'
);

insert into public.group_invitations (
  id, group_id, issued_by, token_hash, requires_approval
) values (
  '51000000-0000-0000-0000-000000000505',
  '50000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000507',
  decode(repeat('0b', 32), 'hex'),
  true
);

insert into public.group_join_requests (
  id, group_id, invitation_id, applicant_id
) values (
  '52000000-0000-0000-0000-000000000505',
  '50000000-0000-0000-0000-000000000501',
  '51000000-0000-0000-0000-000000000505',
  '00000000-0000-0000-0000-000000000508'
);

delete from public.group_members
where group_id = '50000000-0000-0000-0000-000000000501'
  and user_id = '00000000-0000-0000-0000-000000000507';

select is(
  (
    select count(*)::integer
    from public.group_invitations
    where id = '51000000-0000-0000-0000-000000000505'
  ),
  0,
  'leaving the group removes invitations issued by that member'
);
select is(
  (
    select count(*)::integer
    from public.group_join_requests
    where id = '52000000-0000-0000-0000-000000000505'
  ),
  1,
  'a submitted join request remains after the issuer leaves'
);
select is(
  (
    select invitation_id
    from public.group_join_requests
    where id = '52000000-0000-0000-0000-000000000505'
  ),
  null,
  'a submitted request clears the deleted invitation reference'
);

delete from auth.users
where id = '00000000-0000-0000-0000-000000000508';

select is(
  (
    select count(*)::integer
    from public.group_join_requests
    where id = '52000000-0000-0000-0000-000000000505'
  ),
  0,
  'deleting an applicant removes their join requests'
);

delete from auth.users
where id = '00000000-0000-0000-0000-000000000504';

select is(
  (
    select count(*)::integer
    from public.group_join_requests
    where status = 'rejected'
      and resolved_by = '00000000-0000-0000-0000-000000000504'
  ),
  0,
  'deleting a resolver removes requests they resolved'
);

delete from auth.users
where id = '00000000-0000-0000-0000-000000000506';

select is(
  (
    select count(*)::integer
    from public.group_invitations
    where id = '51000000-0000-0000-0000-000000000502'
  ),
  0,
  'deleting an invitation user removes the used invitation'
);

insert into public.group_join_requests (
  group_id, invitation_id, applicant_id
) values (
  '50000000-0000-0000-0000-000000000502',
  '51000000-0000-0000-0000-000000000504',
  '00000000-0000-0000-0000-000000000505'
);

delete from public.groups
where id = '50000000-0000-0000-0000-000000000502';

select is(
  (
    select count(*)::integer
    from public.group_invitations
    where group_id = '50000000-0000-0000-0000-000000000502'
  ),
  0,
  'deleting a group removes its invitations'
);
select is(
  (
    select count(*)::integer
    from public.group_join_requests
    where group_id = '50000000-0000-0000-0000-000000000502'
  ),
  0,
  'deleting a group removes its join requests'
);

set local role authenticated;
select throws_ok(
  $$select count(*) from public.group_invitations$$,
  '42501',
  null,
  'authenticated users cannot directly read invitations before policies exist'
);
select throws_ok(
  $$select count(*) from public.group_join_requests$$,
  '42501',
  null,
  'authenticated users cannot directly read join requests before policies exist'
);
reset role;

select * from finish();
rollback;
