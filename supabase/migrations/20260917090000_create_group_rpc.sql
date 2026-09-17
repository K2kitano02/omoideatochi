create function public.create_group(p_name text)
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

  -- Serialize creation for this user before counting their groups.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('create_group:' || v_user_id::text, 0)
  );

  select count(*)
  into v_group_count
  from public.groups
  where created_by = v_user_id;

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

revoke all on function public.create_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;

-- All group creation must use the RPC so the limit and owner membership cannot be bypassed.
revoke insert on public.groups, public.group_members from public, anon, authenticated;
