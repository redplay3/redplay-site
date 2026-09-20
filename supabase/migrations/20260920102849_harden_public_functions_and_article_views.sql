create index if not exists article_revisions_article_id_idx on public.article_revisions(article_id);
create index if not exists article_revisions_created_by_idx on public.article_revisions(created_by);
create index if not exists articles_author_id_idx on public.articles(author_id);
create index if not exists kr_chatgpt_handoffs_snapshot_id_idx on public.kr_chatgpt_handoffs(snapshot_id);

alter function public.touch_kr_ingest_item_updated_at() set search_path = pg_catalog;
alter function public.touch_kr_ingest_adaptation_updated_at() set search_path = pg_catalog;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.save_article_revision() from public, anon, authenticated;
revoke execute on function public.touch_kr_ingest_item_updated_at() from public, anon, authenticated;
revoke execute on function public.touch_kr_ingest_adaptation_updated_at() from public, anon, authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke execute on function public.get_kr_chatgpt_handoff(text) from public, authenticated;
grant execute on function public.get_kr_chatgpt_handoff(text) to anon, service_role;

create table if not exists public.article_view_uniques (
  page_key text not null check (length(page_key) between 1 and 220 and page_key ~ '^/lineage-2/[a-z0-9/-]+$'),
  view_date date not null default current_date,
  visitor_hash text not null check (length(visitor_hash) = 32),
  created_at timestamptz not null default now(),
  primary key (page_key, view_date, visitor_hash)
);
alter table public.article_view_uniques enable row level security;
revoke all on table public.article_view_uniques from anon, authenticated;
grant all on table public.article_view_uniques to service_role;
create index if not exists article_view_uniques_created_at_idx on public.article_view_uniques(created_at);

create or replace function public.register_article_view(p_page_key text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  next_count bigint;
  request_headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  visitor_hash text;
  inserted_count integer;
begin
  if p_page_key is null
    or length(p_page_key) not between 1 and 220
    or p_page_key !~ '^/lineage-2/[a-z0-9/-]+$'
  then
    raise exception 'Invalid article path';
  end if;

  visitor_hash := md5(
    p_page_key || '|' || current_date::text || '|' ||
    coalesce(split_part(request_headers->>'x-forwarded-for', ',', 1), 'unknown') || '|' ||
    coalesce(request_headers->>'user-agent', 'unknown')
  );

  insert into public.article_view_uniques (page_key, view_date, visitor_hash)
  values (p_page_key, current_date, visitor_hash)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    insert into public.article_views (page_key, view_count)
    values (p_page_key, 1)
    on conflict (page_key) do update
      set view_count = public.article_views.view_count + 1,
          updated_at = now()
    returning view_count into next_count;

    insert into public.article_view_daily (page_key, view_date, view_count)
    values (p_page_key, current_date, 1)
    on conflict (page_key, view_date) do update
      set view_count = public.article_view_daily.view_count + 1;
  else
    select view_count into next_count
    from public.article_views
    where page_key = p_page_key;
  end if;

  return coalesce(next_count, 0);
end;
$$;
revoke execute on function public.register_article_view(text) from public;
grant execute on function public.register_article_view(text) to anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'kr_radar_cron_secret') then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'kr_radar_cron_secret',
      'Shared secret for the scheduled RedPlay KR radar'
    );
  end if;
end
$$;

select cron.unschedule('redplay-kr-radar-8h');
select cron.schedule(
  'redplay-kr-radar-8h',
  '0 */8 * * *',
  $cron$
    select net.http_get(
      url := 'https://vpsocmwsvwyavrmduzth.supabase.co/functions/v1/kr-radar',
      headers := jsonb_build_object(
        'x-redplay-radar-key',
        (select decrypted_secret from vault.decrypted_secrets where name = 'kr_radar_cron_secret')
      ),
      timeout_milliseconds := 20000
    );
  $cron$
);
