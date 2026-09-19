create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- A private definer function avoids recursive policies on group_members.
create function private.current_member_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select group_id
  from public.group_members
  where user_id = (select auth.uid());
$$;

revoke all on function private.current_member_group_ids() from public, anon, authenticated;
grant execute on function private.current_member_group_ids() to authenticated;

revoke all on public.groups, public.group_members from public, anon, authenticated;
grant select on public.groups, public.group_members to authenticated;
grant update (name) on public.groups to authenticated;
grant delete on public.groups to authenticated;

create policy groups_select_member
on public.groups
for select
to authenticated
using (id in (select private.current_member_group_ids()));

create policy groups_update_owner
on public.groups
for update
to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy groups_delete_owner
on public.groups
for delete
to authenticated
using (created_by = (select auth.uid()));

create policy group_members_select_member
on public.group_members
for select
to authenticated
using (group_id in (select private.current_member_group_ids()));
