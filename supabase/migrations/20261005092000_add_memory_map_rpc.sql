create function public.get_memory_map_posts(
  p_group_ids uuid[] default '{}',
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  post_id uuid,
  kind text,
  group_id uuid,
  latitude double precision,
  longitude double precision,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  perform private.validate_memory_page(p_limit, p_before_created_at, p_before_id);

  if p_group_ids is null
    or coalesce(pg_catalog.array_ndims(p_group_ids), 1) <> 1
    or exists (select 1 from pg_catalog.unnest(p_group_ids) as selections(id) where selections.id is null) then
    raise exception 'invalid_group_selection' using errcode = '22023';
  end if;

  -- Validate the entire selection before returning any post. Deduplicate IDs.
  for v_group_id in
    select distinct selections.id from pg_catalog.unnest(p_group_ids) as selections(id)
  loop
    perform private.require_memory_group(v_group_id);
  end loop;

  return query
  select
    posts.id, posts.kind, posts.group_id,
    extensions.st_y(posts.location::extensions.geometry),
    extensions.st_x(posts.location::extensions.geometry),
    posts.created_at
  from public.memory_posts as posts
  where posts.deleted_at is null
    and (
      (posts.kind = 'personal' and posts.author_id = v_user_id)
      or (posts.kind = 'group' and posts.group_id = any(p_group_ids))
    )
    and private.can_read_memory_post(posts.author_id, posts.kind, posts.group_id, posts.deleted_at)
    and (p_before_created_at is null
      or (posts.created_at, posts.id) < (p_before_created_at, p_before_id))
  order by posts.created_at desc, posts.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_memory_map_posts(uuid[], integer, timestamptz, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_memory_map_posts(uuid[], integer, timestamptz, uuid)
to authenticated;
