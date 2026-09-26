create table public.profiles (
  user_id uuid primary key,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint profiles_display_name_check check (
    display_name = btrim(display_name)
    and char_length(display_name) between 1 and 15
  )
);

alter table public.profiles enable row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (user_id, display_name) on public.profiles to authenticated;

create function private.can_view_profile(p_user_id uuid)
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
      where viewer_membership.user_id = (select auth.uid())
        and target_membership.user_id = p_user_id
    );
$$;

revoke all on function private.can_view_profile(uuid)
from public, anon, authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;

create policy profiles_select_self_or_shared_group
on public.profiles
for select
to authenticated
using ((select private.can_view_profile(user_id)));

create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create function private.set_profile_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_profile_updated_at()
from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_profile_updated_at();

create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := new.raw_user_meta_data ->> 'display_name';

  if v_display_name is null then
    return new;
  end if;

  insert into public.profiles (user_id, display_name)
  values (new.id, v_display_name);

  return new;
end;
$$;

revoke all on function private.create_profile_for_new_user()
from public, anon, authenticated;

create trigger auth_user_create_profile
after insert on auth.users
for each row
execute function private.create_profile_for_new_user();
