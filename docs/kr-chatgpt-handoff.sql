create table if not exists public.kr_chatgpt_handoffs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.kr_ingest_items(id) on delete cascade,
  snapshot_id uuid not null references public.kr_ingest_snapshots(id) on delete cascade,
  token_hash text not null unique,
  payload jsonb not null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_by uuid null,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz null,
  revoked_at timestamptz null
);

create index if not exists kr_chatgpt_handoffs_item_idx
  on public.kr_chatgpt_handoffs(item_id, created_at desc);
create index if not exists kr_chatgpt_handoffs_expiry_idx
  on public.kr_chatgpt_handoffs(expires_at);

alter table public.kr_chatgpt_handoffs enable row level security;

drop policy if exists kr_chatgpt_handoffs_admin_all on public.kr_chatgpt_handoffs;
create policy kr_chatgpt_handoffs_admin_all
on public.kr_chatgpt_handoffs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.get_kr_chatgpt_handoff(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  update public.kr_chatgpt_handoffs
     set last_accessed_at = now()
   where token_hash = p_token_hash
     and revoked_at is null
     and expires_at > now()
  returning payload into v_payload;

  return v_payload;
end;
$$;

revoke all on function public.get_kr_chatgpt_handoff(text) from public;
grant execute on function public.get_kr_chatgpt_handoff(text) to anon, authenticated;
