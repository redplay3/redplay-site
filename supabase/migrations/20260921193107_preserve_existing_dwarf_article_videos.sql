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
      set content = case
            when jsonb_path_exists(
              content,
              '$[*].blocks[*] ? (@.url == $target)',
              jsonb_build_object('target', 'https://www.youtube.com/watch?v=IpjqO_8_0-Q')
            ) then content
            else jsonb_insert(
              content,
              '{0,blocks,0}',
              jsonb_build_object(
                'id', case slug
                  when 'iskatel-udachi-forged-in-battle' then 'redplay-gnomes-video-fortune-2026'
                  else 'redplay-gnomes-video-maestro-2026'
                end,
                'url', 'https://www.youtube.com/watch?v=IpjqO_8_0-Q',
                'text', 'Смотри полный разбор Искателя Удачи и Маэстро: новая боевая модель, ключевые умения, Spoil, Broken Armor и обновлённый крафт.',
                'type', 'video',
                'title', 'Гномы в Lineage 2 Essence: Искатель Удачи и Маэстро',
                'source', 'youtube',
                'caption', 'Полный видеоразбор обновлённых гномов'
              ),
              false
            )
          end,
          video_url = 'https://www.youtube.com/watch?v=IpjqO_8_0-Q',
          updated_at = now()
      where slug in (
        'iskatel-udachi-forged-in-battle',
        'maestro-forged-in-battle'
      )
        and jsonb_typeof(content #> '{0,blocks}') = 'array';

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
