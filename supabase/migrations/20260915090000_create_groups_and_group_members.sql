create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint groups_name_check check (
    name = btrim(name)
    and char_length(name) between 1 and 100
  ),
  constraint groups_created_by_fkey
    foreign key (created_by)
    references auth.users (id)
    on delete restrict
);

create index groups_created_by_idx on public.groups (created_by);

create table public.group_members (
  group_id uuid not null,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  constraint group_members_pkey primary key (group_id, user_id),
  constraint group_members_group_id_fkey
    foreign key (group_id)
    references public.groups (id)
    on delete cascade,
  constraint group_members_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade
);

create index group_members_user_id_idx on public.group_members (user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
