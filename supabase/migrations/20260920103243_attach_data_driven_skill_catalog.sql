update public.articles
set content = (
  select jsonb_agg(
    case
      when section->>'id' = 'skills'
        and not exists (
          select 1
          from jsonb_array_elements(coalesce(section->'blocks', '[]'::jsonb)) as block
          where block->>'type' = 'skill-catalog'
        )
      then jsonb_set(
        section,
        '{blocks}',
        coalesce(section->'blocks', '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'id', 'samurai-skill-catalog',
            'type', 'skill-catalog',
            'classSlug', 'crow_3',
            'title', 'Полная база навыков Самурая',
            'scope', 'all'
          )
        )
      )
      else section
    end
    order by ordinal
  )
  from jsonb_array_elements(content) with ordinality as sections(section, ordinal)
)
where edition = 'essence'
  and category = 'classes'
  and slug = 'samurai-guide-2026';

update public.articles
set cover = jsonb_set(
  coalesce(cover, '{}'::jsonb),
  '{alt}',
  to_jsonb('Forged in Battle: классы, умения и изменения Lineage 2 Essence и Special Project'::text)
)
where slug = 'forged-in-battle-vse-klassy-i-umeniya'
  and (cover->>'alt' is null or btrim(cover->>'alt') = '');
