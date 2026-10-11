-- Private preview files are stored in the database, never in the public repository.
create table public.editor_preview_assets (
  preview_slug text not null,
  asset_path text not null,
  body_base64 text not null,
  updated_at timestamptz not null default now(),
  primary key (preview_slug, asset_path)
);
alter table public.editor_preview_assets enable row level security;
revoke all on public.editor_preview_assets from anon, authenticated;
grant select on public.editor_preview_assets to authenticated;
create policy "Admins can read editor preview files"
  on public.editor_preview_assets for select to authenticated
  using ((select public.is_admin()));
