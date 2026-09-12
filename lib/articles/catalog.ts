import type { ArticleCategory, ArticleEdition } from "./types";

export const articleCategories: Array<{ value: ArticleCategory; label: string }> = [
  { value: "news", label: "Новости" },
  { value: "updates", label: "Обновления" },
  { value: "guides", label: "Гайды" },
  { value: "classes", label: "Классы" },
  { value: "skills", label: "Умения" },
  { value: "zones", label: "Зоны охоты" },
  { value: "items", label: "Предметы" },
  { value: "comparisons", label: "Сравнения" },
  { value: "calculators", label: "Калькуляторы" },
];

export const articleEditions: Array<{ value: ArticleEdition; label: string }> = [
  { value: "main", label: "Main" },
  { value: "essence", label: "Essence / Special Project" },
];

export function buildArticlePath(edition: ArticleEdition, category: ArticleCategory, slug: string) {
  return `/lineage-2/${edition}/${category}/${slug}`;
}
