create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set search_path = public, extensions;

select no_plan();

delete from public.groups
where id in (
  '24c00000-0000-0000-0000-000000000001',
  '24c00000-0000-0000-0000-000000000002'
);
delete from auth.users
where id in (
  '00000000-0000-0000-0000-000000002451',
  '00000000-0000-0000-0000-000000002452',
  '00000000-0000-0000-0000-000000002453'
);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000002451', 'concurrency-owner@example.test'),
  ('00000000-0000-0000-0000-000000002452', 'concurrency-member@example.test'),
  ('00000000-0000-0000-0000-000000002453', 'concurrency-applicant@example.test');

insert into public.groups (id, name, created_by)
values
  ('24c00000-0000-0000-0000-000000000001', 'Concurrent leave', '00000000-0000-0000-0000-000000002451'),
  ('24c00000-0000-0000-0000-000000000002', 'Concurrent dissolve', '00000000-0000-0000-0000-000000002451');

insert into public.group_members (group_id, user_id)
values
  ('24c00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000002451'),
  ('24c00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000002452'),
  ('24c00000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000002451');

insert into public.group_join_requests (
  id,
  group_id,
  applicant_id
)
values (
  '24c20000-0000-0000-0000-000000000001',
  '24c00000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000002453'
);

create or replace function private.test_group_lifecycle_call(
  p_user_id uuid,
  p_operation text,
  p_group_id uuid,
  p_request_id uuid default null
)
returns text
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    p_user_id::text,
    true
  );

  if p_operation = 'leave' then
    perform public.leave_group(p_group_id);
    return 'ok';
  end if;

  if p_operation = 'dissolve' then
    perform public.dissolve_group(p_group_id);
    return 'ok';
  end if;

  if p_operation = 'approve' then
    return public.resolve_group_join_request(p_request_id, true);
  end if;

  raise exception 'unknown_test_operation';
exception
  when others then
    return sqlstate || ':' || sqlerrm;
end;
$$;

revoke all on function private.test_group_lifecycle_call(uuid, text, uuid, uuid)
from public, anon, authenticated, service_role;

do $$
begin
  perform extensions.dblink_connect(
    'lifecycle_a',
    'hostaddr=' || pg_catalog.host(pg_catalog.inet_server_addr())
      || ' port=5432 dbname=' || pg_catalog.current_database()
      || ' user=postgres password=postgres'
  );
  perform extensions.dblink_connect(
    'lifecycle_b',
    'hostaddr=' || pg_catalog.host(pg_catalog.inet_server_addr())
      || ' port=5432 dbname=' || pg_catalog.current_database()
      || ' user=postgres password=postgres'
  );
end;
$$;

begin;
select 1
from public.groups
where id = '24c00000-0000-0000-0000-000000000001'
for update;

do $$
begin
  perform extensions.dblink_send_query(
    'lifecycle_a',
    $query$
      select private.test_group_lifecycle_call(
        '00000000-0000-0000-0000-000000002452',
        'leave',
        '24c00000-0000-0000-0000-000000000001'
      )
    $query$
  );
  perform extensions.dblink_send_query(
    'lifecycle_b',
    $query$
      select private.test_group_lifecycle_call(
        '00000000-0000-0000-0000-000000002452',
        'leave',
        '24c00000-0000-0000-0000-000000000001'
      )
    $query$
  );
end;
$$;
commit;

create temporary table concurrent_results (
  scenario text not null,
  result text not null
) on commit preserve rows;

insert into concurrent_results
select 'leave', result
from extensions.dblink_get_result('lifecycle_a') as response(result text);
insert into concurrent_results
select 'leave', result
from extensions.dblink_get_result('lifecycle_b') as response(result text);

insert into concurrent_results
select 'clear', result
from extensions.dblink_get_result('lifecycle_a') as response(result text);
insert into concurrent_results
select 'clear', result
from extensions.dblink_get_result('lifecycle_b') as response(result text);
delete from concurrent_results where scenario = 'clear';

select results_eq(
  $$
    select result
    from concurrent_results
    where scenario = 'leave'
    order by result
  $$,
  $$values ('ok'::text), ('P0001:member_not_found'::text)$$,
  'two concurrent leave calls produce one success and one already-left result'
);
select is(
  (
    select count(*)::integer
    from public.group_members
    where group_id = '24c00000-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-000000002452'
  ),
  0,
  'concurrent leave calls leave no duplicate membership state'
);

begin;
select 1
from public.groups
where id = '24c00000-0000-0000-0000-000000000002'
for update;

do $$
begin
  perform extensions.dblink_send_query(
    'lifecycle_a',
    $query$
      select private.test_group_lifecycle_call(
        '00000000-0000-0000-0000-000000002451',
        'approve',
        '24c00000-0000-0000-0000-000000000002',
        '24c20000-0000-0000-0000-000000000001'
      )
    $query$
  );
  perform extensions.dblink_send_query(
    'lifecycle_b',
    $query$
      select private.test_group_lifecycle_call(
        '00000000-0000-0000-0000-000000002451',
        'dissolve',
        '24c00000-0000-0000-0000-000000000002'
      )
    $query$
  );
end;
$$;
commit;

insert into concurrent_results
select 'approve_or_dissolve', result
from extensions.dblink_get_result('lifecycle_a') as response(result text);
insert into concurrent_results
select 'approve_or_dissolve', result
from extensions.dblink_get_result('lifecycle_b') as response(result text);

select is(
  (
    select count(*)::integer
    from concurrent_results
    where scenario = 'approve_or_dissolve'
      and result = 'ok'
  ),
  1,
  'concurrent dissolution completes without a deadlock'
);
select ok(
  (
    select result in ('approved', 'P0001:group_dissolved')
    from concurrent_results
    where scenario = 'approve_or_dissolve'
      and result <> 'ok'
  ),
  'concurrent approval either completes first or observes dissolution'
);
select ok(
  (
    select dissolved_at is not null
    from public.groups
    where id = '24c00000-0000-0000-0000-000000000002'
  ),
  'the concurrently dissolved group remains marked as dissolved'
);
select is(
  (
    select count(*)::integer
    from public.group_members
    where group_id = '24c00000-0000-0000-0000-000000000002'
  ),
  0,
  'concurrent approval cannot leave a member in a dissolved group'
);
select isnt(
  (
    select status
    from public.group_join_requests
    where id = '24c20000-0000-0000-0000-000000000001'
  ),
  'pending',
  'concurrent approval and dissolution resolve the pending request'
);

do $$
begin
  perform extensions.dblink_disconnect('lifecycle_a');
  perform extensions.dblink_disconnect('lifecycle_b');
end;
$$;

drop function private.test_group_lifecycle_call(uuid, text, uuid, uuid);
delete from public.groups
where id in (
  '24c00000-0000-0000-0000-000000000001',
  '24c00000-0000-0000-0000-000000000002'
);
delete from auth.users
where id in (
  '00000000-0000-0000-0000-000000002451',
  '00000000-0000-0000-0000-000000002452',
  '00000000-0000-0000-0000-000000002453'
);

select * from finish();
