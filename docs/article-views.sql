-- Выполнить один раз в Supabase → SQL Editor.
create table if not exists public.article_views (
  page_key text primary key check (length(page_key) between 1 and 220 and page_key ~ '^/lineage-2/[a-z0-9/-]+$'),
  view_count bigint not null default 0 check (view_count >= 0),
  updated_at timestamptz not null default now()
);

-- Дневные просмотры нужны для честного блока «Популярное за 30 дней».
create table if not exists public.article_view_daily (
  page_key text not null check (length(page_key) between 1 and 220 and page_key ~ '^/lineage-2/[a-z0-9/-]+$'),
  view_date date not null default current_date,
  view_count bigint not null default 0 check (view_count >= 0),
  primary key (page_key, view_date)
);

alter table public.article_view_daily enable row level security;
drop policy if exists "Public can read daily article views" on public.article_view_daily;
create policy "Public can read daily article views" on public.article_view_daily for select to anon, authenticated using (true);
grant select on public.article_view_daily to anon, authenticated;

-- При первом обновлении сохраняем накопленные просмотры как стартовую точку.
insert into public.article_view_daily (page_key, view_date, view_count)
select page_key, current_date, view_count from public.article_views
on conflict (page_key, view_date) do nothing;

alter table public.article_views enable row level security;
drop policy if exists "Public can read article views" on public.article_views;
create policy "Public can read article views" on public.article_views for select to anon, authenticated using (true);
grant select on public.article_views to anon, authenticated;

create or replace function public.register_article_view(p_page_key text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare next_count bigint;
begin
  if p_page_key is null or length(p_page_key) not between 1 and 220 or p_page_key !~ '^/lineage-2/[a-z0-9/-]+$' then
    raise exception 'Invalid article path';
  end if;
  insert into public.article_views (page_key, view_count) values (p_page_key, 1)
  on conflict (page_key) do update set view_count = public.article_views.view_count + 1, updated_at = now()
  returning view_count into next_count;
  insert into public.article_view_daily (page_key, view_date, view_count) values (p_page_key, current_date, 1)
  on conflict (page_key, view_date) do update set view_count = public.article_view_daily.view_count + 1;
  return next_count;
end;
$$;

revoke all on function public.register_article_view(text) from public;
grant execute on function public.register_article_view(text) to anon, authenticated;
