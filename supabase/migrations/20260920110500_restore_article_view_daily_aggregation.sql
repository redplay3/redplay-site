create table if not exists public.article_view_daily (
  page_key text not null,
  view_date date not null default current_date,
  view_count bigint not null default 0 check (view_count >= 0),
  primary key (page_key, view_date)
);

alter table public.article_view_daily enable row level security;
revoke all on table public.article_view_daily from public, anon, authenticated;
grant all on table public.article_view_daily to service_role;

drop policy if exists "No direct access to article daily views" on public.article_view_daily;
create policy "No direct access to article daily views"
on public.article_view_daily
as restrictive
for all
to public
using (false)
with check (false);
