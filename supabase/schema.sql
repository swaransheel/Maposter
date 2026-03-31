-- Supabase schema for MAPOSTER user profiles, posters, journal, and collections.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.posters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  city text not null,
  country text,
  latitude double precision,
  longitude double precision,
  theme text not null,
  image_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  poster_id uuid not null references public.posters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, poster_id)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  poster_id uuid not null references public.posters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, poster_id)
);

create table if not exists public.notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  poster_id uuid not null references public.posters(id) on delete cascade,
  note text not null,
  mood text,
  updated_at timestamptz not null default now(),
  primary key (user_id, poster_id)
);

alter table public.profiles enable row level security;
alter table public.posters enable row level security;
alter table public.favorites enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.notes enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update using (auth.uid() = id);

drop policy if exists posters_all_own on public.posters;
create policy posters_all_own on public.posters
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists favorites_all_own on public.favorites;
create policy favorites_all_own on public.favorites
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists collections_all_own on public.collections;
create policy collections_all_own on public.collections
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notes_all_own on public.notes;
create policy notes_all_own on public.notes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists collection_items_select_own on public.collection_items;
create policy collection_items_select_own on public.collection_items
for select using (
  exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  )
);

drop policy if exists collection_items_insert_own on public.collection_items;
create policy collection_items_insert_own on public.collection_items
for insert with check (
  exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  )
);

drop policy if exists collection_items_delete_own on public.collection_items;
create policy collection_items_delete_own on public.collection_items
for delete using (
  exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = auth.uid()
  )
);
