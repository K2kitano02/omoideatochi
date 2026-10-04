-- One private file may back independent personal and group posts.
-- object_key is an internal storage identifier, never a public/signed URL.
create table public.memory_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  object_key text not null,
  created_at timestamptz not null default now(),
  constraint memory_photos_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete restrict,
  constraint memory_photos_object_key_check check (
    object_key <> '' and object_key !~ '^[[:space:]]|[[:space:]]$'
  ),
  constraint memory_photos_object_key_key unique (object_key),
  constraint memory_photos_id_owner_key unique (id, owner_id)
);

create index memory_photos_owner_id_idx on public.memory_photos (owner_id);

create table public.memory_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  kind text not null,
  group_id uuid,
  photo_id uuid not null,
  location extensions.geography(Point, 4326) not null,
  captured_at timestamptz not null,
  memo text,
  discovery_radius_m integer default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint memory_posts_author_id_fkey
    foreign key (author_id) references auth.users (id) on delete restrict,
  constraint memory_posts_group_id_fkey
    foreign key (group_id) references public.groups (id) on delete restrict,
  constraint memory_posts_photo_owner_fkey
    foreign key (photo_id, author_id)
    references public.memory_photos (id, owner_id) on delete restrict,
  constraint memory_posts_kind_check check (kind in ('personal', 'group')),
  constraint memory_posts_destination_check check (
    (kind = 'personal' and group_id is null)
    or (kind = 'group' and group_id is not null)
  ),
  constraint memory_posts_discovery_radius_check check (
    (kind = 'personal' and discovery_radius_m is not null
      and discovery_radius_m in (0, 500, 1000))
    or (kind = 'group' and discovery_radius_m is null)
  ),
  constraint memory_posts_location_check check (
    not extensions.st_isempty(location::extensions.geometry)
    and extensions.st_x(location::extensions.geometry) between -180 and 180
    and extensions.st_y(location::extensions.geometry) between -90 and 90
  ),
  constraint memory_posts_deleted_at_check check (
    deleted_at is null or deleted_at >= created_at
  )
);

create index memory_posts_author_id_idx on public.memory_posts (author_id);
create index memory_posts_group_id_idx on public.memory_posts (group_id);
create index memory_posts_photo_owner_idx on public.memory_posts (photo_id, author_id);
create index memory_posts_location_idx on public.memory_posts using gist (location);

-- Deny all app access until authorized RPCs are added in subsequent issues.
-- RLS also protects the tables if SELECT is accidentally granted later.
alter table public.memory_photos enable row level security;
alter table public.memory_posts enable row level security;
revoke all on public.memory_photos, public.memory_posts from public, anon, authenticated;

comment on table public.memory_photos is
  'Shared private photo metadata. Retain the file while any undeleted personal post or undeleted post in an active group references it. Physical cleanup is implemented separately.';
comment on column public.memory_photos.object_key is
  'Private storage object identifier. Do not store or expose public or signed URLs here.';
comment on table public.memory_posts is
  'Independent personal/group memory posts. Soft deletion of one post must not delete another post sharing its photo.';
comment on column public.memory_posts.deleted_at is
  'Stops new access once authorized readers exist; physical photo cleanup is separate. Readers must also exclude dissolved groups.';
comment on column public.memory_posts.discovery_radius_m is
  'Personal discovery radius: 0 (private), 500 or 1000 meters. NULL for group posts. Not an ongoing viewing-distance requirement.';
