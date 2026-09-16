-- KR Inbox storage. Выполнить один раз в Supabase SQL Editor.
-- Зависит от существующей public.is_admin(), которую уже использует RedPlay Admin.

create table if not exists public.kr_ingest_items (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  edition text check (edition in ('essence','main')),
  source_kind text not null,
  primary_url text not null,
  plaync_url text,
  article_id text,
  feed_id text,
  title_kr text,
  status text not null default 'new' check (status in ('new','processing','review','ready','published','ignored')),
  latest_snapshot_version integer not null default 0 check (latest_snapshot_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kr_ingest_snapshots (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.kr_ingest_items(id) on delete cascade,
  version integer not null check (version > 0),
  source_url text not null,
  content_hash text not null,
  fetched_at timestamptz not null,
  http_status integer not null,
  content_type text,
  title_kr text,
  raw_body text not null,
  metrics jsonb not null default '{}'::jsonb,
  parser_version text not null default 'kr-parser/0.1',
  created_at timestamptz not null default now(),
  unique (item_id, version),
  unique (item_id, content_hash)
);

create table if not exists public.kr_ingest_blocks (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.kr_ingest_snapshots(id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  block_type text not null,
  source_type text,
  text_kr text,
  raw_html text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, ordinal)
);

create index if not exists kr_ingest_items_status_idx on public.kr_ingest_items(status, updated_at desc);
create index if not exists kr_ingest_items_article_idx on public.kr_ingest_items(article_id) where article_id is not null;
create index if not exists kr_ingest_items_feed_idx on public.kr_ingest_items(feed_id) where feed_id is not null;
create index if not exists kr_ingest_snapshots_item_idx on public.kr_ingest_snapshots(item_id, version desc);
create index if not exists kr_ingest_blocks_snapshot_idx on public.kr_ingest_blocks(snapshot_id, ordinal);

alter table public.kr_ingest_items enable row level security;
alter table public.kr_ingest_snapshots enable row level security;
alter table public.kr_ingest_blocks enable row level security;

drop policy if exists "Admins manage KR ingest items" on public.kr_ingest_items;
create policy "Admins manage KR ingest items" on public.kr_ingest_items
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage KR ingest snapshots" on public.kr_ingest_snapshots;
create policy "Admins manage KR ingest snapshots" on public.kr_ingest_snapshots
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage KR ingest blocks" on public.kr_ingest_blocks;
create policy "Admins manage KR ingest blocks" on public.kr_ingest_blocks
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on public.kr_ingest_items to authenticated;
grant select, insert, update, delete on public.kr_ingest_snapshots to authenticated;
grant select, insert, update, delete on public.kr_ingest_blocks to authenticated;

create or replace function public.touch_kr_ingest_item_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kr_ingest_items_touch_updated_at on public.kr_ingest_items;
create trigger kr_ingest_items_touch_updated_at
before update on public.kr_ingest_items
for each row execute function public.touch_kr_ingest_item_updated_at();
