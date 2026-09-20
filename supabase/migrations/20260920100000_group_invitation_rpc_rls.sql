create function public.create_group_invitation(p_group_id uuid)
returns table (
  invitation_token text,
  expires_at timestamptz,
  requires_approval boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_token text;
  v_created_at timestamptz := pg_catalog.now();
  v_expires_at timestamptz;
  v_requires_approval boolean;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select groups.created_by
  into v_owner_id
  from public.groups
  join public.group_members
    on group_members.group_id = groups.id
   and group_members.user_id = v_user_id
  where groups.id = p_group_id;

  if not found then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := v_created_at + interval '10 minutes';
  v_requires_approval := v_owner_id <> v_user_id;

  insert into public.group_invitations (
    group_id,
    issued_by,
    token_hash,
    requires_approval,
    created_at,
    expires_at
  ) values (
    p_group_id,
    v_user_id,
    extensions.digest(v_token, 'sha256'),
    v_requires_approval,
    v_created_at,
    v_expires_at
  );

  return query
  select v_token, v_expires_at, v_requires_approval;
end;
$$;

create function public.preview_group_invitation(p_token text)
returns table (
  group_id uuid,
  group_name text,
  requires_approval boolean,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_group_name text;
  v_requires_approval boolean;
  v_expires_at timestamptz;
  v_used_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  select
    invitations.group_id,
    groups.name,
    invitations.requires_approval,
    invitations.expires_at,
    invitations.used_at
  into
    v_group_id,
    v_group_name,
    v_requires_approval,
    v_expires_at,
    v_used_at
  from public.group_invitations as invitations
  join public.groups
    on groups.id = invitations.group_id
  where invitations.token_hash = extensions.digest(p_token, 'sha256');

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  if v_used_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  end if;

  if pg_catalog.now() >= v_expires_at then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;

  return query
  select v_group_id, v_group_name, v_requires_approval, v_expires_at;
end;
$$;

revoke all on function public.create_group_invitation(uuid)
from public, anon, authenticated;
grant execute on function public.create_group_invitation(uuid)
to authenticated;

revoke all on function public.preview_group_invitation(text)
from public, anon, authenticated;
grant execute on function public.preview_group_invitation(text)
to authenticated;

create function private.lock_group_membership_capacity(p_group_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'group_membership:' || p_group_id::text,
      0
    )
  );

  select count(*)
  into v_member_count
  from public.group_members
  where group_members.group_id = p_group_id;

  return v_member_count;
end;
$$;

revoke all on function private.lock_group_membership_capacity(uuid)
from public, anon, authenticated, service_role;

create function public.redeem_group_invitation(
  p_token text,
  p_consent boolean
)
returns table (
  outcome text,
  group_id uuid,
  join_request_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation_id uuid;
  v_group_id uuid;
  v_requires_approval boolean;
  v_expires_at timestamptz;
  v_used_at timestamptz;
  v_member_count integer;
  v_join_request_id uuid;
  v_outcome text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_consent is not true then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;

  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  select
    invitations.id,
    invitations.group_id,
    invitations.requires_approval,
    invitations.expires_at,
    invitations.used_at
  into
    v_invitation_id,
    v_group_id,
    v_requires_approval,
    v_expires_at,
    v_used_at
  from public.group_invitations as invitations
  where invitations.token_hash = extensions.digest(p_token, 'sha256')
  for update;

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  if v_used_at is not null then
    raise exception 'invitation_used' using errcode = 'P0001';
  end if;

  if pg_catalog.now() >= v_expires_at then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;

  v_member_count := private.lock_group_membership_capacity(v_group_id);

  if exists (
    select 1
    from public.group_members
    where group_members.group_id = v_group_id
      and group_members.user_id = v_user_id
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.group_join_requests
    where group_join_requests.group_id = v_group_id
      and group_join_requests.applicant_id = v_user_id
      and group_join_requests.status = 'pending'
  ) then
    raise exception 'request_already_pending' using errcode = 'P0001';
  end if;

  if v_member_count >= 10 then
    raise exception 'group_full' using errcode = 'P0001';
  end if;

  if v_requires_approval then
    insert into public.group_join_requests (
      group_id,
      invitation_id,
      applicant_id
    ) values (
      v_group_id,
      v_invitation_id,
      v_user_id
    )
    returning id into v_join_request_id;

    v_outcome := 'pending';
  else
    insert into public.group_members (group_id, user_id)
    values (v_group_id, v_user_id);

    v_outcome := 'joined';
  end if;

  update public.group_invitations
  set
    used_at = pg_catalog.now(),
    used_by = v_user_id
  where group_invitations.id = v_invitation_id;

  return query
  select v_outcome, v_group_id, v_join_request_id;
end;
$$;

revoke all on function public.redeem_group_invitation(text, boolean)
from public, anon, authenticated;
grant execute on function public.redeem_group_invitation(text, boolean)
to authenticated;

create function public.list_group_join_requests(p_group_id uuid)
returns table (
  request_id uuid,
  applicant_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.groups
    where groups.id = p_group_id
      and groups.created_by = v_user_id
  ) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  return query
  select
    requests.id,
    requests.applicant_id,
    requests.created_at
  from public.group_join_requests as requests
  where requests.group_id = p_group_id
    and requests.status = 'pending'
  order by requests.created_at, requests.id;
end;
$$;

create function public.get_my_group_join_requests()
returns table (
  request_id uuid,
  group_id uuid,
  group_name text,
  status text,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  return query
  select
    requests.id,
    requests.group_id,
    groups.name,
    requests.status,
    requests.created_at,
    requests.resolved_at
  from public.group_join_requests as requests
  join public.groups
    on groups.id = requests.group_id
  where requests.applicant_id = v_user_id
  order by requests.created_at desc, requests.id desc;
end;
$$;

create function public.cancel_group_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_applicant_id uuid;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select requests.applicant_id, requests.status
  into v_applicant_id, v_status
  from public.group_join_requests as requests
  where requests.id = p_request_id
  for update;

  if not found or v_applicant_id <> v_user_id then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if v_status <> 'pending' then
    raise exception 'request_not_pending' using errcode = 'P0001';
  end if;

  update public.group_join_requests
  set
    status = 'cancelled',
    resolved_at = pg_catalog.now(),
    resolved_by = null
  where group_join_requests.id = p_request_id;
end;
$$;

create function public.resolve_group_join_request(
  p_request_id uuid,
  p_approve boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_applicant_id uuid;
  v_status text;
  v_member_count integer;
  v_resolved_status text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_approve is null then
    raise exception 'invalid_argument' using errcode = '22023';
  end if;

  select
    requests.group_id,
    requests.applicant_id,
    requests.status
  into
    v_group_id,
    v_applicant_id,
    v_status
  from public.group_join_requests as requests
  where requests.id = p_request_id
  for update;

  if not found then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.groups
    where groups.id = v_group_id
      and groups.created_by = v_user_id
  ) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if v_status <> 'pending' then
    raise exception 'request_not_pending' using errcode = 'P0001';
  end if;

  if p_approve then
    v_member_count := private.lock_group_membership_capacity(v_group_id);

    if exists (
      select 1
      from public.group_members
      where group_members.group_id = v_group_id
        and group_members.user_id = v_applicant_id
    ) then
      raise exception 'already_member' using errcode = 'P0001';
    end if;

    if v_member_count >= 10 then
      raise exception 'group_full' using errcode = 'P0001';
    end if;

    insert into public.group_members (group_id, user_id)
    values (v_group_id, v_applicant_id);

    v_resolved_status := 'approved';
  else
    v_resolved_status := 'rejected';
  end if;

  update public.group_join_requests
  set
    status = v_resolved_status,
    resolved_at = pg_catalog.now(),
    resolved_by = v_user_id
  where group_join_requests.id = p_request_id;

  return v_resolved_status;
end;
$$;

revoke all on function public.list_group_join_requests(uuid)
from public, anon, authenticated;
grant execute on function public.list_group_join_requests(uuid)
to authenticated;

revoke all on function public.get_my_group_join_requests()
from public, anon, authenticated;
grant execute on function public.get_my_group_join_requests()
to authenticated;

revoke all on function public.cancel_group_join_request(uuid)
from public, anon, authenticated;
grant execute on function public.cancel_group_join_request(uuid)
to authenticated;

revoke all on function public.resolve_group_join_request(uuid, boolean)
from public, anon, authenticated;
grant execute on function public.resolve_group_join_request(uuid, boolean)
to authenticated;

revoke all on public.group_invitations, public.group_join_requests
from public, anon, authenticated;
