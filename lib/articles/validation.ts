import type { ArticleSection } from "@/lib/articles/types";

export function validateArticleSections(sections: ArticleSection[]) {
  const errors: string[] = [];
  const sectionIds = new Set<string>();
  const blockIds = new Set<string>();

  for (const section of sections) {
    if (!section.id.trim()) errors.push("У раздела отсутствует адрес.");
    if (!section.label.trim()) errors.push(`У раздела ${section.id || "без адреса"} отсутствует название.`);
    if (sectionIds.has(section.id)) errors.push(`Повторяется адрес раздела: ${section.id}.`);
    sectionIds.add(section.id);

    for (const block of section.blocks) {
      if (!block.id.trim()) errors.push(`В разделе «${section.label}» есть блок без идентификатора.`);
      if (blockIds.has(block.id)) errors.push(`Повторяется идентификатор блока: ${block.id}.`);
      blockIds.add(block.id);

      if (block.type === "image" && (!block.src.trim() || !block.alt.trim())) {
        errors.push(`В разделе «${section.label}» у изображения нет адреса или описания.`);
      }
      if (block.type === "table") {
        if (!block.columns.length) errors.push(`В разделе «${section.label}» есть таблица без колонок.`);
        if (block.rows.some((row) => row.length !== block.columns.length)) {
          errors.push(`В разделе «${section.label}» строки таблицы не совпадают с количеством колонок.`);
        }
      }
      if (block.type === "skill-catalog" && !block.classSlug.trim()) {
        errors.push(`В разделе «${section.label}» не выбран класс для базы навыков.`);
      }
    }
  }

  return [...new Set(errors)];
}
