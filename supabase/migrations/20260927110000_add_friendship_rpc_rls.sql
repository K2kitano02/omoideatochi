create function public.get_my_friend_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('friend_code:' || v_user_id::text, 0)
  );

  select friend_codes.code
  into v_code
  from public.friend_codes
  where friend_codes.user_id = v_user_id;

  if not found then
    insert into public.friend_codes (user_id)
    values (v_user_id)
    returning code into v_code;
  end if;

  return v_code;
end;
$$;

create function public.regenerate_my_friend_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('friend_code:' || v_user_id::text, 0)
  );

  insert into public.friend_codes (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  update public.friend_codes
  set
    code = pg_catalog.upper(
      pg_catalog.encode(extensions.gen_random_bytes(8), 'hex')
    ),
    updated_at = pg_catalog.now()
  where friend_codes.user_id = v_user_id
  returning code into v_code;

  return v_code;
end;
$$;

revoke all on function public.get_my_friend_code()
from public, anon, authenticated;
grant execute on function public.get_my_friend_code()
to authenticated;

revoke all on function public.regenerate_my_friend_code()
from public, anon, authenticated;
grant execute on function public.regenerate_my_friend_code()
to authenticated;

create function private.lock_friend_pair(
  p_user_a uuid,
  p_user_b uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first_user uuid;
  v_second_user uuid;
begin
  if p_user_a < p_user_b then
    v_first_user := p_user_a;
    v_second_user := p_user_b;
  else
    v_first_user := p_user_b;
    v_second_user := p_user_a;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'friend_pair:' || v_first_user::text || ':' || v_second_user::text,
      0
    )
  );
end;
$$;

revoke all on function private.lock_friend_pair(uuid, uuid)
from public, anon, authenticated, service_role;

create function public.preview_friend_code(p_code text)
returns table (display_name text)
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

  if p_code is null or p_code !~ '^[0-9A-F]{16}$' then
    raise exception 'friend_code_not_found' using errcode = 'P0001';
  end if;

  return query
  select profiles.display_name
  from public.friend_codes
  join public.profiles
    on profiles.user_id = friend_codes.user_id
  where friend_codes.code = p_code;

  if not found then
    raise exception 'friend_code_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create function public.create_friend_request(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipient_id uuid;
  v_active_status text;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_code is null or p_code !~ '^[0-9A-F]{16}$' then
    raise exception 'friend_code_not_found' using errcode = 'P0001';
  end if;

  select friend_codes.user_id
  into v_recipient_id
  from public.friend_codes
  join public.profiles
    on profiles.user_id = friend_codes.user_id
  where friend_codes.code = p_code;

  if not found then
    raise exception 'friend_code_not_found' using errcode = 'P0001';
  end if;

  if v_recipient_id = v_user_id then
    raise exception 'cannot_friend_self' using errcode = 'P0001';
  end if;

  perform private.lock_friend_pair(v_user_id, v_recipient_id);

  select friend_relationships.status
  into v_active_status
  from public.friend_relationships
  where (
      (
        friend_relationships.requester_id = v_user_id
        and friend_relationships.recipient_id = v_recipient_id
      ) or (
        friend_relationships.requester_id = v_recipient_id
        and friend_relationships.recipient_id = v_user_id
      )
    )
    and friend_relationships.status in ('pending', 'accepted')
  order by
    case friend_relationships.status
      when 'accepted' then 0
      else 1
    end
  limit 1;

  if v_active_status = 'accepted' then
    raise exception 'already_friends' using errcode = 'P0001';
  end if;

  if v_active_status = 'pending' then
    raise exception 'friend_request_already_pending' using errcode = 'P0001';
  end if;

  insert into public.friend_relationships (requester_id, recipient_id)
  values (v_user_id, v_recipient_id)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.preview_friend_code(text)
from public, anon, authenticated;
grant execute on function public.preview_friend_code(text)
to authenticated;

revoke all on function public.create_friend_request(text)
from public, anon, authenticated;
grant execute on function public.create_friend_request(text)
to authenticated;

create function public.list_received_friend_requests()
returns table (
  request_id uuid,
  requester_display_name text,
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

  return query
  select
    relationships.id,
    profiles.display_name,
    relationships.created_at
  from public.friend_relationships as relationships
  join public.profiles
    on profiles.user_id = relationships.requester_id
  where relationships.recipient_id = v_user_id
    and relationships.status = 'pending'
  order by relationships.created_at, relationships.id;
end;
$$;

create function public.list_sent_friend_requests()
returns table (
  request_id uuid,
  recipient_display_name text,
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

  return query
  select
    relationships.id,
    profiles.display_name,
    relationships.created_at
  from public.friend_relationships as relationships
  join public.profiles
    on profiles.user_id = relationships.recipient_id
  where relationships.requester_id = v_user_id
    and relationships.status = 'pending'
  order by relationships.created_at, relationships.id;
end;
$$;

create function public.resolve_friend_request(
  p_request_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_requester_id uuid;
  v_recipient_id uuid;
  v_status text;
  v_resolved_status text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_accept is null then
    raise exception 'invalid_argument' using errcode = '22023';
  end if;

  select
    relationships.requester_id,
    relationships.recipient_id
  into
    v_requester_id,
    v_recipient_id
  from public.friend_relationships as relationships
  where relationships.id = p_request_id;

  if not found or v_recipient_id <> v_user_id then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  perform private.lock_friend_pair(v_requester_id, v_recipient_id);

  select relationships.status
  into v_status
  from public.friend_relationships as relationships
  where relationships.id = p_request_id
    and relationships.recipient_id = v_user_id
  for update;

  if not found then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if v_status <> 'pending' then
    raise exception 'request_not_pending' using errcode = 'P0001';
  end if;

  v_resolved_status := case when p_accept then 'accepted' else 'rejected' end;

  update public.friend_relationships
  set
    status = v_resolved_status,
    resolved_at = pg_catalog.now()
  where friend_relationships.id = p_request_id;

  return v_resolved_status;
end;
$$;

revoke all on function public.list_received_friend_requests()
from public, anon, authenticated;
grant execute on function public.list_received_friend_requests()
to authenticated;

revoke all on function public.list_sent_friend_requests()
from public, anon, authenticated;
grant execute on function public.list_sent_friend_requests()
to authenticated;

revoke all on function public.resolve_friend_request(uuid, boolean)
from public, anon, authenticated;
grant execute on function public.resolve_friend_request(uuid, boolean)
to authenticated;

create function public.list_friends()
returns table (
  relationship_id uuid,
  display_name text,
  accepted_at timestamptz
)
language plpgsql
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
    relationships.id,
    profiles.display_name,
    relationships.resolved_at
  from public.friend_relationships as relationships
  join public.profiles as profiles
    on profiles.user_id = case
      when relationships.requester_id = v_user_id
        then relationships.recipient_id
      else relationships.requester_id
    end
  where relationships.status = 'accepted'
    and (
      relationships.requester_id = v_user_id
      or relationships.recipient_id = v_user_id
    )
  order by relationships.resolved_at desc, relationships.id;
end;
$$;

create function public.remove_friend(p_relationship_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_requester_id uuid;
  v_recipient_id uuid;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  select
    relationships.requester_id,
    relationships.recipient_id,
    relationships.status
  into
    v_requester_id,
    v_recipient_id,
    v_status
  from public.friend_relationships as relationships
  where relationships.id = p_relationship_id;

  if not found
    or v_status <> 'accepted'
    or v_user_id not in (v_requester_id, v_recipient_id)
  then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  perform private.lock_friend_pair(v_requester_id, v_recipient_id);

  select
    relationships.requester_id,
    relationships.recipient_id,
    relationships.status
  into
    v_requester_id,
    v_recipient_id,
    v_status
  from public.friend_relationships as relationships
  where relationships.id = p_relationship_id
  for update;

  if not found
    or v_status <> 'accepted'
    or v_user_id not in (v_requester_id, v_recipient_id)
  then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  delete from public.friend_relationships
  where friend_relationships.id = p_relationship_id;
end;
$$;

revoke all on function public.list_friends()
from public, anon, authenticated;
grant execute on function public.list_friends()
to authenticated;

revoke all on function public.remove_friend(uuid)
from public, anon, authenticated;
grant execute on function public.remove_friend(uuid)
to authenticated;
