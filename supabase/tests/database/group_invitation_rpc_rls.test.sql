begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select no_plan();

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000601', 'invitation-rpc-owner@example.test'),
  ('00000000-0000-0000-0000-000000000602', 'invitation-rpc-member@example.test'),
  ('00000000-0000-0000-0000-000000000603', 'invitation-rpc-outsider@example.test'),
  ('00000000-0000-0000-0000-000000000604', 'invitation-rpc-applicant@example.test'),
  ('00000000-0000-0000-0000-000000000605', 'invitation-rpc-other-owner@example.test'),
  ('00000000-0000-0000-0000-000000000606', 'invitation-rpc-requester@example.test'),
  ('00000000-0000-0000-0000-000000000607', 'invitation-rpc-canceller@example.test'),
  ('00000000-0000-0000-0000-000000000608', 'invitation-rpc-approved@example.test'),
  ('00000000-0000-0000-0000-000000000609', 'invitation-rpc-rejected@example.test'),
  ('00000000-0000-0000-0000-000000000610', 'invitation-rpc-full-owner@example.test'),
  ('00000000-0000-0000-0000-000000000611', 'invitation-rpc-full-1@example.test'),
  ('00000000-0000-0000-0000-000000000612', 'invitation-rpc-full-2@example.test'),
  ('00000000-0000-0000-0000-000000000613', 'invitation-rpc-full-3@example.test'),
  ('00000000-0000-0000-0000-000000000614', 'invitation-rpc-full-4@example.test'),
  ('00000000-0000-0000-0000-000000000615', 'invitation-rpc-full-5@example.test'),
  ('00000000-0000-0000-0000-000000000616', 'invitation-rpc-full-6@example.test'),
  ('00000000-0000-0000-0000-000000000617', 'invitation-rpc-full-7@example.test'),
  ('00000000-0000-0000-0000-000000000618', 'invitation-rpc-full-8@example.test'),
  ('00000000-0000-0000-0000-000000000619', 'invitation-rpc-full-9@example.test');

insert into public.groups (id, name, created_by)
values
  (
    '60000000-0000-0000-0000-000000000601',
    'RPC invitation group',
    '00000000-0000-0000-0000-000000000601'
  ),
  (
    '60000000-0000-0000-0000-000000000602',
    'Other RPC invitation group',
    '00000000-0000-0000-0000-000000000605'
  ),
  (
    '60000000-0000-0000-0000-000000000603',
    'Full RPC invitation group',
    '00000000-0000-0000-0000-000000000610'
  );

insert into public.group_members (group_id, user_id)
values
  ('60000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000601'),
  ('60000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000602'),
  ('60000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000605'),
  ('60000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000610'),
  ('60000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000611'),
  ('60000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000612'),
  ('60000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000613'),
  ('60000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000614'),
  ('60000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000615'),
  ('60000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000616'),
  ('60000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000617'),
  ('60000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000618'),
  ('60000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000619');

select has_function(
  'public',
  'create_group_invitation',
  array['uuid'],
  'invitation creation RPC exists'
);
select has_function(
  'public',
  'preview_group_invitation',
  array['text'],
  'invitation preview RPC exists'
);

select ok(
  coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.create_group_invitation(uuid)'),
      'EXECUTE'
    ),
    false
  ),
  'authenticated users can execute invitation creation'
);
select ok(
  not coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure('public.create_group_invitation(uuid)'),
      'EXECUTE'
    ),
    false
  ),
  'anonymous users cannot execute invitation creation'
);
select ok(
  coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.preview_group_invitation(text)'),
      'EXECUTE'
    ),
    false
  ),
  'authenticated users can execute invitation preview'
);
select ok(
  not coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure('public.preview_group_invitation(text)'),
      'EXECUTE'
    ),
    false
  ),
  'anonymous users cannot execute invitation preview'
);

set local role anon;
select throws_ok(
  $$select * from public.create_group_invitation('60000000-0000-0000-0000-000000000601')$$,
  '42501',
  null,
  'anonymous users cannot create invitations'
);
select throws_ok(
  $$select * from public.preview_group_invitation(repeat('a', 64))$$,
  '42501',
  null,
  'anonymous users cannot preview invitations'
);
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok(
  $$select * from public.create_group_invitation('60000000-0000-0000-0000-000000000601')$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot create an invitation'
);
select throws_ok(
  $$select * from public.preview_group_invitation(repeat('a', 64))$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot preview an invitation'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000603', true);
set local role authenticated;
select throws_ok(
  $$select * from public.create_group_invitation('60000000-0000-0000-0000-000000000601')$$,
  '42501',
  'permission_denied',
  'a group outsider cannot create an invitation'
);
select throws_ok(
  $$select * from public.create_group_invitation(null)$$,
  '42501',
  'permission_denied',
  'a null group ID does not expose internal details'
);
reset role;

create temporary table captured_invitations (
  issuer_kind text not null,
  invitation_token text not null,
  expires_at timestamptz not null,
  requires_approval boolean not null
) on commit drop;

grant insert, select on pg_temp.captured_invitations to authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
set local role authenticated;
insert into pg_temp.captured_invitations
select 'owner', invitation.*
from public.create_group_invitation(
  '60000000-0000-0000-0000-000000000601'
) as invitation;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
set local role authenticated;
insert into pg_temp.captured_invitations
select 'member', invitation.*
from public.create_group_invitation(
  '60000000-0000-0000-0000-000000000601'
) as invitation;
reset role;

select is(
  (select count(*)::integer from pg_temp.captured_invitations),
  2,
  'multiple members can create independent invitations for one group'
);
select is(
  (
    select requires_approval
    from pg_temp.captured_invitations
    where issuer_kind = 'owner'
  ),
  false,
  'an owner-issued invitation does not require approval'
);
select is(
  (
    select requires_approval
    from pg_temp.captured_invitations
    where issuer_kind = 'member'
  ),
  true,
  'a member-issued invitation requires approval'
);
select is(
  (
    select bool_and(invitation_token ~ '^[0-9a-f]{64}$')
    from pg_temp.captured_invitations
  ),
  true,
  'issued invitation tokens contain 256 bits encoded as lowercase hex'
);
select is(
  (
    select count(distinct invitation_token)::integer
    from pg_temp.captured_invitations
  ),
  2,
  'separate invitation calls return different tokens'
);
select is(
  (
    select count(*)::integer
    from pg_temp.captured_invitations as captured
    join public.group_invitations as stored
      on stored.token_hash = extensions.digest(captured.invitation_token, 'sha256')
    where stored.group_id = '60000000-0000-0000-0000-000000000601'
      and stored.expires_at = captured.expires_at
      and stored.expires_at = stored.created_at + interval '10 minutes'
  ),
  2,
  'the database stores matching hashes with an exact ten-minute lifetime'
);
select is(
  (
    select count(*)::integer
    from pg_temp.captured_invitations as captured
    join public.group_invitations as stored
      on pg_catalog.encode(stored.token_hash, 'hex') = captured.invitation_token
  ),
  0,
  'the database does not store the plaintext token as token_hash'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000604', true);
set local role authenticated;
select is(
  (
    select preview.group_id
    from public.preview_group_invitation(
      (
        select invitation_token
        from pg_temp.captured_invitations
        where issuer_kind = 'member'
      )
    ) as preview
  ),
  '60000000-0000-0000-0000-000000000601'::uuid,
  'an authenticated invitee can preview the target group'
);
select is(
  (
    select preview.group_name
    from public.preview_group_invitation(
      (
        select invitation_token
        from pg_temp.captured_invitations
        where issuer_kind = 'member'
      )
    ) as preview
  ),
  'RPC invitation group',
  'preview returns the group name'
);
select is(
  (
    select preview.requires_approval
    from public.preview_group_invitation(
      (
        select invitation_token
        from pg_temp.captured_invitations
        where issuer_kind = 'member'
      )
    ) as preview
  ),
  true,
  'preview tells the invitee that owner approval is required'
);
select is(
  (
    select array_agg(key_name order by key_name)
    from public.preview_group_invitation(
      (
        select invitation_token
        from pg_temp.captured_invitations
        where issuer_kind = 'member'
      )
    ) as preview
    cross join lateral jsonb_object_keys(to_jsonb(preview)) as key_name
  ),
  array['expires_at', 'group_id', 'group_name', 'requires_approval']::text[],
  'preview exposes only the safe confirmation fields'
);
select throws_ok(
  $$select * from public.preview_group_invitation(null)$$,
  'P0001',
  'invitation_not_found',
  'a null token is reported as not found'
);
select throws_ok(
  $$select * from public.preview_group_invitation('abc')$$,
  'P0001',
  'invitation_not_found',
  'a malformed token is reported as not found'
);
select throws_ok(
  $$select * from public.preview_group_invitation(repeat('f', 64))$$,
  'P0001',
  'invitation_not_found',
  'an unknown token is reported as not found'
);
reset role;

insert into public.group_invitations (
  group_id,
  issued_by,
  token_hash,
  requires_approval,
  created_at,
  expires_at
) values (
  '60000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000601',
  extensions.digest(repeat('e', 64), 'sha256'),
  false,
  now() - interval '10 minutes',
  now()
);

insert into public.group_invitations (
  group_id,
  issued_by,
  token_hash,
  requires_approval,
  created_at,
  expires_at,
  used_at,
  used_by
) values (
  '60000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000601',
  extensions.digest(repeat('d', 64), 'sha256'),
  false,
  now() - interval '5 minutes',
  now() + interval '5 minutes',
  now() - interval '1 minute',
  '00000000-0000-0000-0000-000000000604'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000604', true);
set local role authenticated;
select throws_ok(
  $$select * from public.preview_group_invitation(repeat('e', 64))$$,
  'P0001',
  'invitation_expired',
  'a token is expired at its exact expiration timestamp'
);
select throws_ok(
  $$select * from public.preview_group_invitation(repeat('d', 64))$$,
  'P0001',
  'invitation_used',
  'a used invitation cannot be previewed again'
);
reset role;

select has_function(
  'public',
  'redeem_group_invitation',
  array['text', 'boolean'],
  'invitation redemption RPC exists'
);
select ok(
  coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.redeem_group_invitation(text, boolean)'),
      'EXECUTE'
    ),
    false
  ),
  'authenticated users can execute invitation redemption'
);
select ok(
  not coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure('public.redeem_group_invitation(text, boolean)'),
      'EXECUTE'
    ),
    false
  ),
  'anonymous users cannot execute invitation redemption'
);

set local role anon;
select throws_ok(
  $$select * from public.redeem_group_invitation(repeat('a', 64), true)$$,
  '42501',
  null,
  'anonymous users cannot redeem invitations'
);
reset role;

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok(
  $$select * from public.redeem_group_invitation(repeat('a', 64), true)$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot redeem an invitation'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
set local role authenticated;
insert into pg_temp.captured_invitations
select 'consent_check', invitation.*
from public.create_group_invitation(
  '60000000-0000-0000-0000-000000000601'
) as invitation;
insert into pg_temp.captured_invitations
select 'owner_join', invitation.*
from public.create_group_invitation(
  '60000000-0000-0000-0000-000000000601'
) as invitation;
insert into pg_temp.captured_invitations
select 'already_member', invitation.*
from public.create_group_invitation(
  '60000000-0000-0000-0000-000000000601'
) as invitation;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
set local role authenticated;
insert into pg_temp.captured_invitations
select 'member_pending', invitation.*
from public.create_group_invitation(
  '60000000-0000-0000-0000-000000000601'
) as invitation;
insert into pg_temp.captured_invitations
select 'member_duplicate', invitation.*
from public.create_group_invitation(
  '60000000-0000-0000-0000-000000000601'
) as invitation;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000610', true);
set local role authenticated;
insert into pg_temp.captured_invitations
select 'full_group', invitation.*
from public.create_group_invitation(
  '60000000-0000-0000-0000-000000000603'
) as invitation;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000604', true);
set local role authenticated;
select throws_ok(
  $$
    select *
    from public.redeem_group_invitation(
      (
        select invitation_token
        from pg_temp.captured_invitations
        where issuer_kind = 'consent_check'
      ),
      false
    )
  $$,
  'P0001',
  'consent_required',
  'redemption requires explicit consent'
);
select throws_ok(
  $$
    select *
    from public.redeem_group_invitation(
      (
        select invitation_token
        from pg_temp.captured_invitations
        where issuer_kind = 'consent_check'
      ),
      null
    )
  $$,
  'P0001',
  'consent_required',
  'null consent is rejected'
);
select throws_ok(
  $$select * from public.redeem_group_invitation(null, true)$$,
  'P0001',
  'invitation_not_found',
  'a null redemption token is reported as not found'
);
select throws_ok(
  $$select * from public.redeem_group_invitation('abc', true)$$,
  'P0001',
  'invitation_not_found',
  'a malformed redemption token is reported as not found'
);
select throws_ok(
  $$select * from public.redeem_group_invitation(repeat('f', 64), true)$$,
  'P0001',
  'invitation_not_found',
  'an unknown redemption token is reported as not found'
);
select throws_ok(
  $$select * from public.redeem_group_invitation(repeat('e', 64), true)$$,
  'P0001',
  'invitation_expired',
  'an expired invitation cannot be redeemed'
);
select throws_ok(
  $$select * from public.redeem_group_invitation(repeat('d', 64), true)$$,
  'P0001',
  'invitation_used',
  'an already used invitation cannot be redeemed'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.group_invitations as stored
    join pg_temp.captured_invitations as captured
      on stored.token_hash = extensions.digest(captured.invitation_token, 'sha256')
    where captured.issuer_kind = 'consent_check'
      and stored.used_at is null
      and stored.used_by is null
  ),
  1,
  'failed consent checks do not consume the invitation'
);

create temporary table redemption_results (
  result_kind text not null,
  outcome text not null,
  group_id uuid not null,
  join_request_id uuid
) on commit drop;

grant insert, select on pg_temp.redemption_results to authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000604', true);
set local role authenticated;
insert into pg_temp.redemption_results
select 'owner_join', redemption.*
from public.redeem_group_invitation(
  (
    select invitation_token
    from pg_temp.captured_invitations
    where issuer_kind = 'owner_join'
  ),
  true
) as redemption;
reset role;

select is(
  (
    select outcome
    from pg_temp.redemption_results
    where result_kind = 'owner_join'
  ),
  'joined',
  'an owner-issued invitation joins immediately'
);
select is(
  (
    select join_request_id
    from pg_temp.redemption_results
    where result_kind = 'owner_join'
  ),
  null,
  'immediate joining does not create a join request'
);
select is(
  (
    select count(*)::integer
    from public.group_members
    where group_id = '60000000-0000-0000-0000-000000000601'
      and user_id = '00000000-0000-0000-0000-000000000604'
  ),
  1,
  'the invitee becomes a group member'
);
select is(
  (
    select count(*)::integer
    from public.group_invitations as stored
    join pg_temp.captured_invitations as captured
      on stored.token_hash = extensions.digest(captured.invitation_token, 'sha256')
    where captured.issuer_kind = 'owner_join'
      and stored.used_at is not null
      and stored.used_by = '00000000-0000-0000-0000-000000000604'
  ),
  1,
  'successful immediate joining consumes the invitation'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000603', true);
set local role authenticated;
select throws_ok(
  $$
    select *
    from public.redeem_group_invitation(
      (
        select invitation_token
        from pg_temp.captured_invitations
        where issuer_kind = 'owner_join'
      ),
      true
    )
  $$,
  'P0001',
  'invitation_used',
  'a successfully used invitation cannot be reused'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
set local role authenticated;
select throws_ok(
  $$
    select *
    from public.redeem_group_invitation(
      (
        select invitation_token
        from pg_temp.captured_invitations
        where issuer_kind = 'already_member'
      ),
      true
    )
  $$,
  'P0001',
  'already_member',
  'an existing member cannot redeem an invitation'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.group_invitations as stored
    join pg_temp.captured_invitations as captured
      on stored.token_hash = extensions.digest(captured.invitation_token, 'sha256')
    where captured.issuer_kind = 'already_member'
      and stored.used_at is null
      and stored.used_by is null
  ),
  1,
  'an existing member does not consume the invitation'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000606', true);
set local role authenticated;
insert into pg_temp.redemption_results
select 'member_pending', redemption.*
from public.redeem_group_invitation(
  (
    select invitation_token
    from pg_temp.captured_invitations
    where issuer_kind = 'member_pending'
  ),
  true
) as redemption;
reset role;

select is(
  (
    select outcome
    from pg_temp.redemption_results
    where result_kind = 'member_pending'
  ),
  'pending',
  'a member-issued invitation creates a pending request'
);
select isnt(
  (
    select join_request_id
    from pg_temp.redemption_results
    where result_kind = 'member_pending'
  ),
  null,
  'pending redemption returns its join request ID'
);
select is(
  (
    select count(*)::integer
    from public.group_join_requests
    where group_id = '60000000-0000-0000-0000-000000000601'
      and applicant_id = '00000000-0000-0000-0000-000000000606'
      and status = 'pending'
  ),
  1,
  'pending redemption stores one join request'
);
select is(
  (
    select count(*)::integer
    from public.group_members
    where group_id = '60000000-0000-0000-0000-000000000601'
      and user_id = '00000000-0000-0000-0000-000000000606'
  ),
  0,
  'a pending applicant is not yet a group member'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000606', true);
set local role authenticated;
select throws_ok(
  $$
    select *
    from public.redeem_group_invitation(
      (
        select invitation_token
        from pg_temp.captured_invitations
        where issuer_kind = 'member_duplicate'
      ),
      true
    )
  $$,
  'P0001',
  'request_already_pending',
  'an applicant cannot create a second pending request'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.group_invitations as stored
    join pg_temp.captured_invitations as captured
      on stored.token_hash = extensions.digest(captured.invitation_token, 'sha256')
    where captured.issuer_kind = 'member_duplicate'
      and stored.used_at is null
      and stored.used_by is null
  ),
  1,
  'a duplicate pending request does not consume the new invitation'
);

update public.group_join_requests
set
  status = 'rejected',
  resolved_at = now(),
  resolved_by = '00000000-0000-0000-0000-000000000601'
where group_id = '60000000-0000-0000-0000-000000000601'
  and applicant_id = '00000000-0000-0000-0000-000000000606'
  and status = 'pending';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000606', true);
set local role authenticated;
insert into pg_temp.redemption_results
select 'member_retry', redemption.*
from public.redeem_group_invitation(
  (
    select invitation_token
    from pg_temp.captured_invitations
    where issuer_kind = 'member_duplicate'
  ),
  true
) as redemption;
reset role;

select is(
  (
    select count(*)::integer
    from public.group_join_requests
    where group_id = '60000000-0000-0000-0000-000000000601'
      and applicant_id = '00000000-0000-0000-0000-000000000606'
      and status = 'pending'
  ),
  1,
  'an applicant can request again after rejection with a new invitation'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000603', true);
set local role authenticated;
select throws_ok(
  $$
    select *
    from public.redeem_group_invitation(
      (
        select invitation_token
        from pg_temp.captured_invitations
        where issuer_kind = 'full_group'
      ),
      true
    )
  $$,
  'P0001',
  'group_full',
  'a full group rejects invitation redemption'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.group_invitations as stored
    join pg_temp.captured_invitations as captured
      on stored.token_hash = extensions.digest(captured.invitation_token, 'sha256')
    where captured.issuer_kind = 'full_group'
      and stored.used_at is null
      and stored.used_by is null
  ),
  1,
  'a full group does not consume the invitation'
);

select is(
  (
    select array_agg(key_name order by key_name)
    from pg_temp.redemption_results as redemption
    cross join lateral jsonb_object_keys(
      to_jsonb(redemption) - 'result_kind'
    ) as key_name
    where redemption.result_kind = 'owner_join'
  ),
  array['group_id', 'join_request_id', 'outcome']::text[],
  'redemption exposes only its safe result fields'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
set local role authenticated;
insert into pg_temp.captured_invitations
select 'cancel_request', invitation.*
from public.create_group_invitation(
  '60000000-0000-0000-0000-000000000601'
) as invitation;
insert into pg_temp.captured_invitations
select 'approve_request', invitation.*
from public.create_group_invitation(
  '60000000-0000-0000-0000-000000000601'
) as invitation;
insert into pg_temp.captured_invitations
select 'reject_request', invitation.*
from public.create_group_invitation(
  '60000000-0000-0000-0000-000000000601'
) as invitation;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000607', true);
set local role authenticated;
insert into pg_temp.redemption_results
select 'cancel_request', redemption.*
from public.redeem_group_invitation(
  (
    select invitation_token
    from pg_temp.captured_invitations
    where issuer_kind = 'cancel_request'
  ),
  true
) as redemption;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000608', true);
set local role authenticated;
insert into pg_temp.redemption_results
select 'approve_request', redemption.*
from public.redeem_group_invitation(
  (
    select invitation_token
    from pg_temp.captured_invitations
    where issuer_kind = 'approve_request'
  ),
  true
) as redemption;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000609', true);
set local role authenticated;
insert into pg_temp.redemption_results
select 'reject_request', redemption.*
from public.redeem_group_invitation(
  (
    select invitation_token
    from pg_temp.captured_invitations
    where issuer_kind = 'reject_request'
  ),
  true
) as redemption;
reset role;

select has_function(
  'public',
  'list_group_join_requests',
  array['uuid'],
  'owner join request list RPC exists'
);
select has_function(
  'public',
  'get_my_group_join_requests',
  array[]::text[],
  'applicant join request list RPC exists'
);
select has_function(
  'public',
  'cancel_group_join_request',
  array['uuid'],
  'join request cancellation RPC exists'
);
select has_function(
  'public',
  'resolve_group_join_request',
  array['uuid', 'boolean'],
  'join request resolution RPC exists'
);

select ok(
  coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.list_group_join_requests(uuid)'),
      'EXECUTE'
    ),
    false
  ),
  'authenticated users can execute owner request listing'
);
select ok(
  coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.get_my_group_join_requests()'),
      'EXECUTE'
    ),
    false
  ),
  'authenticated users can execute their request listing'
);
select ok(
  coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.cancel_group_join_request(uuid)'),
      'EXECUTE'
    ),
    false
  ),
  'authenticated users can execute request cancellation'
);
select ok(
  coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('public.resolve_group_join_request(uuid, boolean)'),
      'EXECUTE'
    ),
    false
  ),
  'authenticated users can execute request resolution'
);

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok(
  $$select * from public.list_group_join_requests('60000000-0000-0000-0000-000000000601')$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot list owner requests'
);
select throws_ok(
  $$select * from public.get_my_group_join_requests()$$,
  '28000',
  'authentication_required',
  'a missing user ID cannot list applicant requests'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
set local role authenticated;
select throws_ok(
  $$select * from public.list_group_join_requests('60000000-0000-0000-0000-000000000601')$$,
  '42501',
  'permission_denied',
  'a normal member cannot list group join requests'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
set local role authenticated;
select is(
  (
    select count(*)::integer
    from public.list_group_join_requests(
      '60000000-0000-0000-0000-000000000601'
    )
  ),
  4,
  'the owner sees only the four pending requests'
);
select is(
  (
    select array_agg(applicant_id order by applicant_id)
    from public.list_group_join_requests(
      '60000000-0000-0000-0000-000000000601'
    )
  ),
  array[
    '00000000-0000-0000-0000-000000000606'::uuid,
    '00000000-0000-0000-0000-000000000607'::uuid,
    '00000000-0000-0000-0000-000000000608'::uuid,
    '00000000-0000-0000-0000-000000000609'::uuid
  ],
  'the owner request list contains only pending applicants for that group'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000606', true);
set local role authenticated;
select is(
  (select count(*)::integer from public.get_my_group_join_requests()),
  2,
  'an applicant sees only their own rejected and pending requests'
);
select is(
  (
    select array_agg(status order by status)
    from public.get_my_group_join_requests()
  ),
  array['pending', 'rejected']::text[],
  'the applicant request list includes each of their request states'
);
select is(
  (
    select bool_and(group_name = 'RPC invitation group')
    from public.get_my_group_join_requests()
  ),
  true,
  'the applicant request list includes the safe group name'
);
select is(
  (
    select array_agg(key_name order by key_name)
    from (
      select *
      from public.get_my_group_join_requests()
      limit 1
    ) as request_result
    cross join lateral jsonb_object_keys(to_jsonb(request_result)) as key_name
  ),
  array[
    'created_at',
    'group_id',
    'group_name',
    'request_id',
    'resolved_at',
    'status'
  ]::text[],
  'the applicant request list exposes only safe fields'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000603', true);
set local role authenticated;
select throws_ok(
  $$
    select public.cancel_group_join_request(
      (
        select join_request_id
        from pg_temp.redemption_results
        where result_kind = 'cancel_request'
      )
    )
  $$,
  '42501',
  'permission_denied',
  'another user cannot cancel an applicant request'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000607', true);
set local role authenticated;
select lives_ok(
  $$
    select public.cancel_group_join_request(
      (
        select join_request_id
        from pg_temp.redemption_results
        where result_kind = 'cancel_request'
      )
    )
  $$,
  'an applicant can cancel their pending request'
);
select throws_ok(
  $$
    select public.cancel_group_join_request(
      (
        select join_request_id
        from pg_temp.redemption_results
        where result_kind = 'cancel_request'
      )
    )
  $$,
  'P0001',
  'request_not_pending',
  'a cancelled request cannot be cancelled again'
);
reset role;

select is(
  (
    select status
    from public.group_join_requests
    where id = (
      select join_request_id
      from pg_temp.redemption_results
      where result_kind = 'cancel_request'
    )
  ),
  'cancelled',
  'cancellation stores the cancelled state'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
set local role authenticated;
select throws_ok(
  $$
    select public.resolve_group_join_request(
      (
        select join_request_id
        from pg_temp.redemption_results
        where result_kind = 'approve_request'
      ),
      true
    )
  $$,
  '42501',
  'permission_denied',
  'a normal member cannot approve a request'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
set local role authenticated;
select throws_ok(
  $$
    select public.resolve_group_join_request(
      (
        select join_request_id
        from pg_temp.redemption_results
        where result_kind = 'approve_request'
      ),
      null
    )
  $$,
  '22023',
  'invalid_argument',
  'a null approval decision is rejected'
);
select is(
  public.resolve_group_join_request(
    (
      select join_request_id
      from pg_temp.redemption_results
      where result_kind = 'reject_request'
    ),
    false
  ),
  'rejected',
  'the owner can reject a pending request'
);
select is(
  public.resolve_group_join_request(
    (
      select join_request_id
      from pg_temp.redemption_results
      where result_kind = 'approve_request'
    ),
    true
  ),
  'approved',
  'the owner can approve a pending request'
);
select throws_ok(
  $$
    select public.resolve_group_join_request(
      (
        select join_request_id
        from pg_temp.redemption_results
        where result_kind = 'approve_request'
      ),
      true
    )
  $$,
  'P0001',
  'request_not_pending',
  'an approved request cannot be resolved again'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.group_members
    where group_id = '60000000-0000-0000-0000-000000000601'
      and user_id = '00000000-0000-0000-0000-000000000608'
  ),
  1,
  'approving a request adds the applicant as a member'
);
select is(
  (
    select count(*)::integer
    from public.group_members
    where group_id = '60000000-0000-0000-0000-000000000601'
      and user_id = '00000000-0000-0000-0000-000000000609'
  ),
  0,
  'rejecting a request does not add the applicant'
);

insert into public.group_join_requests (
  id,
  group_id,
  applicant_id
) values (
  '62000000-0000-0000-0000-000000000601',
  '60000000-0000-0000-0000-000000000603',
  '00000000-0000-0000-0000-000000000603'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000610', true);
set local role authenticated;
select throws_ok(
  $$
    select public.resolve_group_join_request(
      '62000000-0000-0000-0000-000000000601',
      true
    )
  $$,
  'P0001',
  'group_full',
  'approval is rejected while the group has ten members'
);
reset role;

select is(
  (
    select status
    from public.group_join_requests
    where id = '62000000-0000-0000-0000-000000000601'
  ),
  'pending',
  'a full-group failure leaves the request pending'
);

delete from public.group_members
where group_id = '60000000-0000-0000-0000-000000000603'
  and user_id = '00000000-0000-0000-0000-000000000619';

insert into public.group_join_requests (
  id,
  group_id,
  applicant_id
) values (
  '62000000-0000-0000-0000-000000000602',
  '60000000-0000-0000-0000-000000000603',
  '00000000-0000-0000-0000-000000000604'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000610', true);
set local role authenticated;
select is(
  public.resolve_group_join_request(
    '62000000-0000-0000-0000-000000000601',
    true
  ),
  'approved',
  'one request can fill the tenth membership slot'
);
select throws_ok(
  $$
    select public.resolve_group_join_request(
      '62000000-0000-0000-0000-000000000602',
      true
    )
  $$,
  'P0001',
  'group_full',
  'the next request cannot create an eleventh member'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.group_members
    where group_id = '60000000-0000-0000-0000-000000000603'
  ),
  10,
  'sequential approvals stop at ten group members'
);
select is(
  (
    select status
    from public.group_join_requests
    where id = '62000000-0000-0000-0000-000000000602'
  ),
  'pending',
  'the request blocked by capacity remains pending'
);

select is(
  (
    select count(*)::integer
    from pg_proc
    where oid in (
      to_regprocedure('public.create_group_invitation(uuid)'),
      to_regprocedure('public.preview_group_invitation(text)'),
      to_regprocedure('public.redeem_group_invitation(text, boolean)'),
      to_regprocedure('public.list_group_join_requests(uuid)'),
      to_regprocedure('public.get_my_group_join_requests()'),
      to_regprocedure('public.cancel_group_join_request(uuid)'),
      to_regprocedure('public.resolve_group_join_request(uuid, boolean)')
    )
      and prosecdef
      and 'search_path=""' = any(proconfig)
  ),
  7,
  'all public invitation RPCs are security definer functions with an empty search path'
);
select ok(
  not coalesce(
    has_function_privilege(
      'authenticated',
      to_regprocedure('private.lock_group_membership_capacity(uuid)'),
      'EXECUTE'
    ),
    false
  ),
  'authenticated users cannot execute the private capacity lock directly'
);
select is(
  (
    select count(*)::integer
    from pg_proc
    where oid in (
      to_regprocedure('public.create_group_invitation(uuid)'),
      to_regprocedure('public.preview_group_invitation(text)'),
      to_regprocedure('public.redeem_group_invitation(text, boolean)'),
      to_regprocedure('public.list_group_join_requests(uuid)'),
      to_regprocedure('public.get_my_group_join_requests()'),
      to_regprocedure('public.cancel_group_join_request(uuid)'),
      to_regprocedure('public.resolve_group_join_request(uuid, boolean)')
    )
      and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  0,
  'anonymous users cannot execute any invitation RPC'
);

select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok(
  $$select count(*) from public.group_invitations$$,
  '42501',
  null,
  'anonymous users cannot directly read invitations'
);
select throws_ok(
  $$select count(*) from public.group_join_requests$$,
  '42501',
  null,
  'anonymous users cannot directly read join requests'
);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
set local role authenticated;
select throws_ok(
  $$select count(*) from public.group_invitations$$,
  '42501',
  null,
  'authenticated users cannot directly read invitations'
);
select throws_ok(
  $$
    insert into public.group_invitations (
      group_id, issued_by, token_hash, requires_approval
    ) values (
      '60000000-0000-0000-0000-000000000601',
      '00000000-0000-0000-0000-000000000601',
      decode(repeat('ab', 32), 'hex'),
      false
    )
  $$,
  '42501',
  null,
  'authenticated users cannot directly insert invitations'
);
select throws_ok(
  $$update public.group_invitations set used_at = now()$$,
  '42501',
  null,
  'authenticated users cannot directly update invitations'
);
select throws_ok(
  $$delete from public.group_invitations$$,
  '42501',
  null,
  'authenticated users cannot directly delete invitations'
);
select throws_ok(
  $$select count(*) from public.group_join_requests$$,
  '42501',
  null,
  'authenticated users cannot directly read join requests'
);
select throws_ok(
  $$
    insert into public.group_join_requests (group_id, applicant_id)
    values (
      '60000000-0000-0000-0000-000000000601',
      '00000000-0000-0000-0000-000000000603'
    )
  $$,
  '42501',
  null,
  'authenticated users cannot directly insert join requests'
);
select throws_ok(
  $$update public.group_join_requests set status = 'rejected'$$,
  '42501',
  null,
  'authenticated users cannot directly update join requests'
);
select throws_ok(
  $$delete from public.group_join_requests$$,
  '42501',
  null,
  'authenticated users cannot directly delete join requests'
);
reset role;

select * from finish();
rollback;
