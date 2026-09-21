create function public.get_owned_group_pending_counts()
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
  where groups.created_by = v_user_id
    and requests.status = 'pending'
  group by requests.group_id
  order by requests.group_id;
end;
$$;

revoke all on function public.get_owned_group_pending_counts()
from public, anon, authenticated;
grant execute on function public.get_owned_group_pending_counts()
to authenticated;
