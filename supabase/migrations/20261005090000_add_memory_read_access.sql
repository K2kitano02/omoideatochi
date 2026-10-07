-- Shared by RLS and every read RPC. Never trust a caller-supplied viewer ID.
create function private.can_read_memory_post(
  p_author_id uuid,
  p_kind text,
  p_group_id uuid,
  p_deleted_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and p_deleted_at is null
    and (
      (p_kind = 'personal' and p_author_id = (select auth.uid()))
      or (p_kind = 'group'
        and p_group_id in (select private.current_member_group_ids()))
    ),
    false
  );
$$;

revoke all on function private.can_read_memory_post(uuid, text, uuid, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function private.can_read_memory_post(uuid, text, uuid, timestamptz)
to authenticated;

create policy memory_posts_select_author_or_member
on public.memory_posts
for select
to authenticated
using (private.can_read_memory_post(author_id, kind, group_id, deleted_at));

-- Policies are defense in depth; clients still cannot read tables directly.
revoke all on public.memory_posts, public.memory_photos from public, anon, authenticated;

create function public.get_memory_post(p_post_id uuid)
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

  return query
  select
    posts.id, posts.author_id, profiles.display_name,
    posts.kind, posts.group_id, posts.photo_id,
    extensions.st_y(posts.location::extensions.geometry),
    extensions.st_x(posts.location::extensions.geometry),
    posts.captured_at, posts.memo, posts.discovery_radius_m, posts.created_at
  from public.memory_posts as posts
  left join public.profiles as profiles on profiles.user_id = posts.author_id
  where posts.id = p_post_id
    and private.can_read_memory_post(posts.author_id, posts.kind, posts.group_id, posts.deleted_at);

  if not found then
    -- Identical errors for missing, deleted and unauthorized records.
    raise exception 'memory_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.get_memory_post(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_memory_post(uuid) to authenticated;
