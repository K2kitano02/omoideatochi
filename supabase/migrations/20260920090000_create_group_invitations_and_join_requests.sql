create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  issued_by uuid not null,
  token_hash bytea not null,
  requires_approval boolean not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  used_by uuid,
  constraint group_invitations_id_group_id_key unique (id, group_id),
  constraint group_invitations_token_hash_key unique (token_hash),
  constraint group_invitations_group_id_fkey
    foreign key (group_id)
    references public.groups (id)
    on delete cascade,
  constraint group_invitations_issuer_membership_fkey
    foreign key (group_id, issued_by)
    references public.group_members (group_id, user_id)
    on delete cascade,
  constraint group_invitations_used_by_fkey
    foreign key (used_by)
    references auth.users (id)
    on delete cascade,
  constraint group_invitations_token_hash_length_check check (
    octet_length(token_hash) = 32
  ),
  constraint group_invitations_expiration_check check (
    expires_at = created_at + interval '10 minutes'
  ),
  constraint group_invitations_usage_check check (
    (used_at is null and used_by is null)
    or (
      used_at is not null
      and used_by is not null
      and used_at >= created_at
      and used_at <= expires_at
    )
  )
);

create index group_invitations_group_active_idx
  on public.group_invitations (group_id, expires_at)
  where used_at is null;

create index group_invitations_issuer_idx
  on public.group_invitations (group_id, issued_by);

create index group_invitations_used_by_idx
  on public.group_invitations (used_by)
  where used_by is not null;

create table public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  invitation_id uuid,
  applicant_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  constraint group_join_requests_group_id_fkey
    foreign key (group_id)
    references public.groups (id)
    on delete cascade,
  constraint group_join_requests_invitation_group_fkey
    foreign key (invitation_id, group_id)
    references public.group_invitations (id, group_id)
    on delete set null (invitation_id),
  constraint group_join_requests_applicant_id_fkey
    foreign key (applicant_id)
    references auth.users (id)
    on delete cascade,
  constraint group_join_requests_resolved_by_fkey
    foreign key (resolved_by)
    references auth.users (id)
    on delete cascade,
  constraint group_join_requests_status_check check (
    status in ('pending', 'approved', 'rejected', 'cancelled')
  ),
  constraint group_join_requests_resolution_check check (
    (status = 'pending' and resolved_at is null and resolved_by is null)
    or (
      status in ('approved', 'rejected')
      and resolved_at is not null
      and resolved_by is not null
    )
    or (
      status = 'cancelled'
      and resolved_at is not null
      and resolved_by is null
    )
  ),
  constraint group_join_requests_resolution_time_check check (
    resolved_at is null or resolved_at >= created_at
  )
);

create index group_join_requests_invitation_id_idx
  on public.group_join_requests (invitation_id)
  where invitation_id is not null;

create index group_join_requests_applicant_id_idx
  on public.group_join_requests (applicant_id);

create index group_join_requests_resolved_by_idx
  on public.group_join_requests (resolved_by)
  where resolved_by is not null;

create index group_join_requests_group_pending_idx
  on public.group_join_requests (group_id, created_at)
  where status = 'pending';

create unique index group_join_requests_one_pending_per_applicant_idx
  on public.group_join_requests (group_id, applicant_id)
  where status = 'pending';

alter table public.group_invitations enable row level security;
alter table public.group_join_requests enable row level security;

revoke all on public.group_invitations, public.group_join_requests
from public, anon, authenticated;
