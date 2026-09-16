-- KR semantic adaptations. Выполнить один раз в Supabase SQL Editor после docs/kr-ingest.sql.
-- Хранит редакционную RU-версию смыслового раздела отдельно от immutable KR snapshot.
-- Примечание: изменение Preview environment variables требует нового Vercel deployment.

create table if not exists public.kr_ingest_adaptations (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.kr_ingest_snapshots(id) on delete cascade,
  section_id text not null,
  section_index integer not null check (section_index >= 0),
  section_kind text not null,
  title_kr text,
  title_ru text not null,
  content jsonb not null default '{}'::jsonb,
  terms jsonb not null default '[]'::jsonb,
  source_ordinals jsonb not null default '[]'::jsonb,
  source_numeric jsonb not null default '[]'::jsonb,
  output_numeric jsonb not null default '[]'::jsonb,
  numeric_status text not null default 'pending' check (numeric_status in ('pending','pass','fail')),
  terminology_status text not null default 'review' check (terminology_status in ('pending','review','verified')),
  status text not null default 'draft' check (status in ('draft','review','approved')),
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_id, section_id)
);

create index if not exists kr_ingest_adaptations_snapshot_idx
  on public.kr_ingest_adaptations(snapshot_id, section_index);

alter table public.kr_ingest_adaptations enable row level security;

drop policy if exists "Admins manage KR adaptations" on public.kr_ingest_adaptations;
create policy "Admins manage KR adaptations" on public.kr_ingest_adaptations
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on public.kr_ingest_adaptations to authenticated;

create or replace function public.touch_kr_ingest_adaptation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kr_ingest_adaptations_touch_updated_at on public.kr_ingest_adaptations;
create trigger kr_ingest_adaptations_touch_updated_at
before update on public.kr_ingest_adaptations
for each row execute function public.touch_kr_ingest_adaptation_updated_at();
