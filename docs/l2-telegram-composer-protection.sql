-- Protect manually composed Telegram digests from automatic radar overwrites.
-- Composer writes status='composed'; radar still writes status='draft'.

alter table public.l2_ru_telegram_digests
  drop constraint if exists l2_ru_telegram_digests_status_check;

alter table public.l2_ru_telegram_digests
  add constraint l2_ru_telegram_digests_status_check
  check (status = any (array['draft'::text, 'composed'::text, 'published'::text, 'archived'::text]));

create schema if not exists private;

create or replace function private.protect_l2_ru_composed_digest()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status in ('composed','published') and new.status = 'draft' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_l2_ru_composed_digest on public.l2_ru_telegram_digests;
create trigger protect_l2_ru_composed_digest
before update on public.l2_ru_telegram_digests
for each row
execute function private.protect_l2_ru_composed_digest();
