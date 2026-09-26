alter table public.groups
add column dissolved_at timestamptz;

alter table public.groups
add constraint groups_dissolved_at_check check (
  dissolved_at is null or dissolved_at >= created_at
);

-- Direct deletion would bypass request cancellation and the dissolved marker.
drop policy if exists groups_delete_owner on public.groups;
revoke delete on public.groups from public, anon, authenticated;

drop policy if exists groups_select_member on public.groups;
create policy groups_select_member
on public.groups
for select
to authenticated
using (
  dissolved_at is null
  and id in (select private.current_member_group_ids())
);

drop policy if exists groups_update_owner on public.groups;
create policy groups_update_owner
on public.groups
for update
to authenticated
using (
  dissolved_at is null
  and created_by = (select auth.uid())
)
with check (
  dissolved_at is null
  and created_by = (select auth.uid())
);

create or replace function private.current_member_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select memberships.group_id
  from public.group_members as memberships
  join public.groups
    on groups.id = memberships.group_id
   and groups.dissolved_at is null
  where memberships.user_id = (select auth.uid());
$$;

create or replace function private.can_view_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.group_members as viewer_membership
      inner join public.group_members as target_membership
        on target_membership.group_id = viewer_membership.group_id
      inner join public.groups
        on groups.id = viewer_membership.group_id
       and groups.dissolved_at is null
      where viewer_membership.user_id = (select auth.uid())
        and target_membership.user_id = p_user_id
    );
$$;

create function private.lock_active_group(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_dissolved_at timestamptz;
begin
  select groups.created_by, groups.dissolved_at
  into v_owner_id, v_dissolved_at
  from public.groups
  where groups.id = p_group_id
  for update;

  if not found then
    raise exception 'group_not_found' using errcode = 'P0001';
  end if;

  if v_dissolved_at is not null then
    raise exception 'group_dissolved' using errcode = 'P0001';
  end if;

  return v_owner_id;
end;
$$;

revoke all on function private.lock_active_group(uuid)
from public, anon, authenticated, service_role;

create or replace function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_group_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_name is null
    or p_name ~ '^[[:space:]]|[[:space:]]$'
    or pg_catalog.char_length(p_name) not between 1 and 100 then
    raise exception 'group name must be 1 to 100 characters without surrounding whitespace'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('create_group:' || v_user_id::text, 0)
  );

  select count(*)
  into v_group_count
  from public.groups
  where groups.created_by = v_user_id
    and groups.dissolved_at is null;

  if v_group_count >= 5 then
    raise exception 'group creation limit reached' using errcode = '22023';
  end if;

  insert into public.groups (name, created_by)
  values (p_name, v_user_id)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_user_id);

  return v_group_id;
end;
$$;

create or replace function public.create_group_invitation(p_group_id uuid)
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

  begin
    v_owner_id := private.lock_active_group(p_group_id);
  exception
    when raise_exception then
      raise exception 'permission_denied' using errcode = '42501';
  end;

  if not exists (
    select 1
    from public.group_members
    where group_members.group_id = p_group_id
      and group_members.user_id = v_user_id
  ) then
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

create or replace function public.preview_group_invitation(p_token text)
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
   and groups.dissolved_at is null
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

create or replace function public.redeem_group_invitation(
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

  select invitations.group_id
  into v_group_id
  from public.group_invitations as invitations
  where invitations.token_hash = extensions.digest(p_token, 'sha256');

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  perform private.lock_active_group(v_group_id);

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

create or replace function public.list_group_join_requests(p_group_id uuid)
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
      and groups.dissolved_at is null
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

create or replace function public.get_my_group_join_requests()
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
   and groups.dissolved_at is null
  where requests.applicant_id = v_user_id
  order by requests.created_at desc, requests.id desc;
end;
$$;

create or replace function public.resolve_group_join_request(
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
  v_owner_id uuid;
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

  select requests.group_id
  into v_group_id
  from public.group_join_requests as requests
  where requests.id = p_request_id;

  if not found then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  v_owner_id := private.lock_active_group(v_group_id);

  if v_owner_id <> v_user_id then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select
    requests.applicant_id,
    requests.status
  into
    v_applicant_id,
    v_status
  from public.group_join_requests as requests
  where requests.id = p_request_id
    and requests.group_id = v_group_id
  for update;

  if not found then
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

create or replace function public.get_owned_group_pending_counts()
returns table (
  group_id uuid,
  pending_count bigint
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
    requests.group_id,
    count(*)::bigint
  from public.group_join_requests as requests
  join public.groups
    on groups.id = requests.group_id
   and groups.dissolved_at is null
  where groups.created_by = v_user_id
    and requests.status = 'pending'
  group by requests.group_id
  order by requests.group_id;
end;
$$;

create function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_deleted_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  v_owner_id := private.lock_active_group(p_group_id);

  if v_owner_id = v_user_id then
    raise exception 'owner_cannot_leave' using errcode = 'P0001';
  end if;

  update public.group_join_requests
  set
    status = 'cancelled',
    resolved_at = pg_catalog.now(),
    resolved_by = null
  where group_join_requests.group_id = p_group_id
    and group_join_requests.applicant_id = v_user_id
    and group_join_requests.status = 'pending';

  delete from public.group_members
  where group_members.group_id = p_group_id
    and group_members.user_id = v_user_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create function public.remove_group_member(
  p_group_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_deleted_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  v_owner_id := private.lock_active_group(p_group_id);

  if v_owner_id <> v_user_id then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if p_user_id = v_owner_id then
    raise exception 'owner_cannot_be_removed' using errcode = 'P0001';
  end if;

  update public.group_join_requests
  set
    status = 'cancelled',
    resolved_at = pg_catalog.now(),
    resolved_by = null
  where group_join_requests.group_id = p_group_id
    and group_join_requests.applicant_id = p_user_id
    and group_join_requests.status = 'pending';

  delete from public.group_members
  where group_members.group_id = p_group_id
    and group_members.user_id = p_user_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception 'member_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create function public.dissolve_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  v_owner_id := private.lock_active_group(p_group_id);

  if v_owner_id <> v_user_id then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  update public.groups
  set dissolved_at = pg_catalog.now()
  where groups.id = p_group_id;

  update public.group_join_requests
  set
    status = 'cancelled',
    resolved_at = pg_catalog.now(),
    resolved_by = null
  where group_join_requests.group_id = p_group_id
    and group_join_requests.status = 'pending';

  delete from public.group_members
  where group_members.group_id = p_group_id;
end;
$$;

revoke all on function public.leave_group(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.leave_group(uuid)
to authenticated;

revoke all on function public.remove_group_member(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.remove_group_member(uuid, uuid)
to authenticated;

revoke all on function public.dissolve_group(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.dissolve_group(uuid)
to authenticated;
