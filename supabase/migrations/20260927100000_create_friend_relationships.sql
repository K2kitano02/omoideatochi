create extension if not exists pgcrypto with schema extensions;

create table public.friend_codes (
  user_id uuid primary key,
  code text not null default upper(encode(extensions.gen_random_bytes(8), 'hex')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_codes_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint friend_codes_code_key unique (code),
  constraint friend_codes_code_format_check check (
    code ~ '^[0-9A-F]{16}$'
  )
);

create table public.friend_relationships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null,
  recipient_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint friend_relationships_requester_id_fkey
    foreign key (requester_id)
    references auth.users (id)
    on delete cascade,
  constraint friend_relationships_recipient_id_fkey
    foreign key (recipient_id)
    references auth.users (id)
    on delete cascade,
  constraint friend_relationships_different_users_check check (
    requester_id <> recipient_id
  ),
  constraint friend_relationships_status_check check (
    status in ('pending', 'accepted', 'rejected')
  ),
  constraint friend_relationships_resolution_check check (
    (status = 'pending' and resolved_at is null)
    or (status in ('accepted', 'rejected') and resolved_at is not null)
  ),
  constraint friend_relationships_resolution_time_check check (
    resolved_at is null or resolved_at >= created_at
  )
);

create index friend_relationships_requester_id_idx
  on public.friend_relationships (requester_id);

create index friend_relationships_recipient_id_idx
  on public.friend_relationships (recipient_id);

create unique index friend_relationships_active_pair_idx
  on public.friend_relationships (
    least(requester_id, recipient_id),
    greatest(requester_id, recipient_id)
  )
  where status in ('pending', 'accepted');

create index friend_relationships_requester_pending_idx
  on public.friend_relationships (requester_id, created_at)
  where status = 'pending';

create index friend_relationships_recipient_pending_idx
  on public.friend_relationships (recipient_id, created_at)
  where status = 'pending';

alter table public.friend_codes enable row level security;
alter table public.friend_relationships enable row level security;

revoke all on public.friend_codes, public.friend_relationships
from public, anon, authenticated;
