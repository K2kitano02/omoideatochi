create function private.validate_memory_page(
  p_limit integer,
  p_before_created_at timestamptz,
  p_before_id uuid
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_limit is null or p_limit not between 1 and 200
    or ((p_before_created_at is null) <> (p_before_id is null)) then
    raise exception 'invalid_pagination' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.validate_memory_page(integer, timestamptz, uuid)
from public, anon, authenticated, service_role;

create function private.require_memory_group(p_group_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_group_id is null or not exists (
    select 1 from private.current_member_group_ids() as memberships(group_id)
    where memberships.group_id = p_group_id
  ) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_memory_group(uuid)
from public, anon, authenticated, service_role;

create function public.get_personal_memory_posts(
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  post_id uuid,
  author_id uuid,
  author_display_name text,
  kind text,
  group_id uuid,
  photo_id uuid,
  latitude double precision,
  longitude double precision,
  captured_at timestamptz,
  memo text,
  discovery_radius_m integer,
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
  perform private.validate_memory_page(p_limit, p_before_created_at, p_before_id);

  return query
  select
    posts.id, posts.author_id, profiles.display_name,
    posts.kind, posts.group_id, posts.photo_id,
    extensions.st_y(posts.location::extensions.geometry),
    extensions.st_x(posts.location::extensions.geometry),
    posts.captured_at, posts.memo, posts.discovery_radius_m, posts.created_at
  from public.memory_posts as posts
  left join public.profiles as profiles on profiles.user_id = posts.author_id
  where posts.kind = 'personal'
    and posts.author_id = v_user_id
    and posts.deleted_at is null
    and private.can_read_memory_post(posts.author_id, posts.kind, posts.group_id, posts.deleted_at)
    and (p_before_created_at is null
      or (posts.created_at, posts.id) < (p_before_created_at, p_before_id))
  order by posts.created_at desc, posts.id desc
  limit p_limit;
end;
$$;

create function public.get_group_memory_posts(
  p_group_id uuid,
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  post_id uuid,
  author_id uuid,
  author_display_name text,
  kind text,
  group_id uuid,
  photo_id uuid,
  latitude double precision,
  longitude double precision,
  captured_at timestamptz,
  memo text,
  discovery_radius_m integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  perform private.validate_memory_page(p_limit, p_before_created_at, p_before_id);
  perform private.require_memory_group(p_group_id);

  return query
  select
    posts.id, posts.author_id, profiles.display_name,
    posts.kind, posts.group_id, posts.photo_id,
    extensions.st_y(posts.location::extensions.geometry),
    extensions.st_x(posts.location::extensions.geometry),
    posts.captured_at, posts.memo, posts.discovery_radius_m, posts.created_at
  from public.memory_posts as posts
  left join public.profiles as profiles on profiles.user_id = posts.author_id
  where posts.kind = 'group'
    and posts.group_id = p_group_id
    and posts.deleted_at is null
    and private.can_read_memory_post(posts.author_id, posts.kind, posts.group_id, posts.deleted_at)
    and (p_before_created_at is null
      or (posts.created_at, posts.id) < (p_before_created_at, p_before_id))
  order by posts.created_at desc, posts.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_personal_memory_posts(integer, timestamptz, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_personal_memory_posts(integer, timestamptz, uuid)
to authenticated;
revoke all on function public.get_group_memory_posts(uuid, integer, timestamptz, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_group_memory_posts(uuid, integer, timestamptz, uuid)
to authenticated;

create index memory_posts_personal_page_idx
on public.memory_posts (author_id, created_at desc, id desc)
where kind = 'personal' and deleted_at is null;
create index memory_posts_group_page_idx
on public.memory_posts (group_id, created_at desc, id desc)
where kind = 'group' and deleted_at is null;
