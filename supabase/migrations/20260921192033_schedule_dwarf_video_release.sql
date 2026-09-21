select cron.schedule(
  'redplay-add-dwarf-video-2026-09-23',
  '* * * * *',
  $cron$
  do $job$
  declare
    updated_count integer;
  begin
    if now() >= timestamptz '2026-09-23 07:00:00+00' then
      update public.articles
      set content = jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  content,
                  '{0,blocks,0,url}',
                  to_jsonb('https://www.youtube.com/watch?v=IpjqO_8_0-Q'::text),
                  false
                ),
                '{0,blocks,0,title}',
                to_jsonb('Гномы в Lineage 2 Essence: Искатель Удачи и Маэстро'::text),
                false
              ),
              '{0,blocks,0,caption}',
              to_jsonb('Полный видеоразбор обновлённых гномов'::text),
              false
            ),
            '{0,blocks,0,text}',
            to_jsonb('Смотри полный разбор Искателя Удачи и Маэстро: новая боевая модель, ключевые умения, Spoil, Broken Armor и обновлённый крафт.'::text),
            false
          ),
          video_url = 'https://www.youtube.com/watch?v=IpjqO_8_0-Q',
          updated_at = now()
      where slug in (
        'iskatel-udachi-forged-in-battle',
        'maestro-forged-in-battle'
      )
        and content #>> '{0,blocks,0,type}' = 'video';

      get diagnostics updated_count = row_count;

      if updated_count <> 2 then
        raise exception 'Expected to update 2 dwarf articles, updated %', updated_count;
      end if;

      perform cron.unschedule('redplay-add-dwarf-video-2026-09-23');
    end if;
  end
  $job$;
  $cron$
);
