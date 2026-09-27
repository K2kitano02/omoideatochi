create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set search_path = public, extensions;

select no_plan();

delete from auth.users
where id in (
  '00000000-0000-0000-0000-000000002801',
  '00000000-0000-0000-0000-000000002802',
  '00000000-0000-0000-0000-000000002803',
  '00000000-0000-0000-0000-000000002804'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '00000000-0000-0000-0000-000000002801',
    'friend-concurrency-a@example.test',
    '{"display_name":"並行A"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000002802',
    'friend-concurrency-b@example.test',
    '{"display_name":"並行B"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000002803',
    'friend-concurrency-c@example.test',
    '{"display_name":"並行C"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000002804',
    'friend-concurrency-d@example.test',
    '{"display_name":"並行D"}'::jsonb
  );

insert into public.friend_codes (user_id, code)
values
  ('00000000-0000-0000-0000-000000002801', '2801000000000001'),
  ('00000000-0000-0000-0000-000000002802', '2802000000000002');

insert into public.friend_relationships (
  id,
  requester_id,
  recipient_id
)
values (
  '28000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000002803',
  '00000000-0000-0000-0000-000000002804'
);

create or replace function private.test_friendship_call(
  p_user_id uuid,
  p_operation text,
  p_argument text,
  p_accept boolean default null
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
  perform pg_catalog.set_config('statement_timeout', '5s', true);

  if p_operation = 'request' then
    perform public.create_friend_request(p_argument);
    return 'ok';
  end if;

  if p_operation = 'resolve' then
    perform public.resolve_friend_request(p_argument::uuid, p_accept);
    return 'ok';
  end if;

  raise exception 'unknown_test_operation';
exception
  when others then
    return sqlstate || ':' || sqlerrm;
end;
$$;

revoke all on function private.test_friendship_call(uuid, text, text, boolean)
from public, anon, authenticated, service_role;

do $$
begin
  perform extensions.dblink_connect(
    'friendship_a',
    'hostaddr=' || pg_catalog.host(pg_catalog.inet_server_addr())
      || ' port=5432 dbname=' || pg_catalog.current_database()
      || ' user=postgres password=postgres'
  );
  perform extensions.dblink_connect(
    'friendship_b',
    'hostaddr=' || pg_catalog.host(pg_catalog.inet_server_addr())
      || ' port=5432 dbname=' || pg_catalog.current_database()
      || ' user=postgres password=postgres'
  );
end;
$$;

create temporary table concurrent_friendship_results (
  scenario text not null,
  result text not null
) on commit preserve rows;

begin;
select private.lock_friend_pair(
  '00000000-0000-0000-0000-000000002801',
  '00000000-0000-0000-0000-000000002802'
);

do $$
begin
  perform extensions.dblink_send_query(
    'friendship_a',
    $query$
      select private.test_friendship_call(
        '00000000-0000-0000-0000-000000002801',
        'request',
        '2802000000000002'
      )
    $query$
  );
  perform extensions.dblink_send_query(
    'friendship_b',
    $query$
      select private.test_friendship_call(
        '00000000-0000-0000-0000-000000002802',
        'request',
        '2801000000000001'
      )
    $query$
  );
end;
$$;
commit;

insert into concurrent_friendship_results
select 'reverse_request', result
from extensions.dblink_get_result('friendship_a') as response(result text);
insert into concurrent_friendship_results
select 'reverse_request', result
from extensions.dblink_get_result('friendship_b') as response(result text);

insert into concurrent_friendship_results
select 'clear', result
from extensions.dblink_get_result('friendship_a') as response(result text);
insert into concurrent_friendship_results
select 'clear', result
from extensions.dblink_get_result('friendship_b') as response(result text);
delete from concurrent_friendship_results where scenario = 'clear';

select is(
  (
    select count(*)::integer
    from concurrent_friendship_results
    where scenario = 'reverse_request'
      and result = 'ok'
  ),
  1,
  'reverse concurrent requests produce one success'
);
select is(
  (
    select count(*)::integer
    from concurrent_friendship_results
    where scenario = 'reverse_request'
      and result = 'P0001:friend_request_already_pending'
  ),
  1,
  'reverse concurrent requests produce one pending error'
);
select is(
  (
    select count(*)::integer
    from public.friend_relationships
    where least(requester_id, recipient_id)
        = '00000000-0000-0000-0000-000000002801'
      and greatest(requester_id, recipient_id)
        = '00000000-0000-0000-0000-000000002802'
      and status = 'pending'
  ),
  1,
  'reverse concurrent requests leave exactly one pending relationship'
);

begin;
select private.lock_friend_pair(
  '00000000-0000-0000-0000-000000002803',
  '00000000-0000-0000-0000-000000002804'
);

do $$
begin
  perform extensions.dblink_send_query(
    'friendship_a',
    $query$
      select private.test_friendship_call(
        '00000000-0000-0000-0000-000000002804',
        'resolve',
        '28000000-0000-0000-0000-000000000001',
        true
      )
    $query$
  );
  perform extensions.dblink_send_query(
    'friendship_b',
    $query$
      select private.test_friendship_call(
        '00000000-0000-0000-0000-000000002804',
        'resolve',
        '28000000-0000-0000-0000-000000000001',
        false
      )
    $query$
  );
end;
$$;
commit;

insert into concurrent_friendship_results
select 'resolve', result
from extensions.dblink_get_result('friendship_a') as response(result text);
insert into concurrent_friendship_results
select 'resolve', result
from extensions.dblink_get_result('friendship_b') as response(result text);

select is(
  (
    select count(*)::integer
    from concurrent_friendship_results
    where scenario = 'resolve'
      and result = 'ok'
  ),
  1,
  'concurrent accept and reject produce one success'
);
select is(
  (
    select count(*)::integer
    from concurrent_friendship_results
    where scenario = 'resolve'
      and result = 'P0001:request_not_pending'
  ),
  1,
  'concurrent accept and reject produce one processed error'
);
select ok(
  (
    select status in ('accepted', 'rejected')
    from public.friend_relationships
    where id = '28000000-0000-0000-0000-000000000001'
  ),
  'concurrent resolution leaves one final non-pending state'
);
select is(
  (
    select count(*)::integer
    from public.friend_relationships
    where id = '28000000-0000-0000-0000-000000000001'
  ),
  1,
  'concurrent resolution does not duplicate or delete the relationship'
);

do $$
begin
  perform extensions.dblink_disconnect('friendship_a');
  perform extensions.dblink_disconnect('friendship_b');
end;
$$;

drop function private.test_friendship_call(uuid, text, text, boolean);
delete from auth.users
where id in (
  '00000000-0000-0000-0000-000000002801',
  '00000000-0000-0000-0000-000000002802',
  '00000000-0000-0000-0000-000000002803',
  '00000000-0000-0000-0000-000000002804'
);

select * from finish();
