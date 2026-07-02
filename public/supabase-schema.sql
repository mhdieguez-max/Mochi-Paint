-- Mochi Paint gallery schema
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query)

create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled masterpiece',
  artist text not null default 'Anonymous artist',
  image_path text not null,
  created_at timestamptz not null default now()
);

alter table public.artworks enable row level security;

drop policy if exists "anyone can view artworks" on public.artworks;
create policy "anyone can view artworks"
  on public.artworks for select
  using (true);

drop policy if exists "anyone can share artworks" on public.artworks;
create policy "anyone can share artworks"
  on public.artworks for insert
  with check (true);

-- Public storage bucket for the PNG files
insert into storage.buckets (id, name, public)
values ('artworks', 'artworks', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public read artwork images" on storage.objects;
create policy "public read artwork images"
  on storage.objects for select
  using (bucket_id = 'artworks');

drop policy if exists "public upload artwork images" on storage.objects;
create policy "public upload artwork images"
  on storage.objects for insert
  with check (
    bucket_id = 'artworks'
    and (storage.foldername(name))[1] is null
  );
