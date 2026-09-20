drop policy if exists "Admins manage articles" on public.articles;
drop policy if exists "Public can read published articles" on public.articles;
drop policy if exists "Anonymous can read published articles" on public.articles;
drop policy if exists "Authenticated can read published articles or admin drafts" on public.articles;
drop policy if exists "Admins can insert articles" on public.articles;
drop policy if exists "Admins can update articles" on public.articles;
drop policy if exists "Admins can delete articles" on public.articles;

create policy "Anonymous can read published articles"
on public.articles for select to anon
using (status = 'published');

create policy "Authenticated can read published articles or admin drafts"
on public.articles for select to authenticated
using (status = 'published' or public.is_admin());

create policy "Admins can insert articles"
on public.articles for insert to authenticated
with check (public.is_admin());

create policy "Admins can update articles"
on public.articles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete articles"
on public.articles for delete to authenticated
using (public.is_admin());

drop policy if exists "Administrators can read their own admin record" on public.admin_users;
create policy "Administrators can read their own admin record"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "No direct access to article view fingerprints" on public.article_view_uniques;
create policy "No direct access to article view fingerprints"
on public.article_view_uniques for all to public
using (false)
with check (false);
