import type { ArticleCategory, ArticleEdition } from "@/lib/articles/types";

export const SITE_URL = "https://redplay.stream";
export const SITE_NAME = "RedPlay";
export const DEFAULT_TITLE = "Lineage 2 – новости, обновления, гайды и база знаний | RedPlay";
export const DEFAULT_DESCRIPTION = "Новости, переводы обновлений, патчноуты, гайды и база знаний по Lineage 2 Main, Essence и Special Project. Классы, умения, зоны охоты, предметы и калькуляторы RedPlay.";

export const semanticCore = {
  primary: [
    "Lineage 2",
    "Lineage 2 новости",
    "Lineage 2 обновления",
    "Lineage 2 гайды",
    "Lineage 2 база знаний",
    "Lineage 2 патчноуты",
  ],
  editions: [
    "Lineage 2 Main",
    "Lineage 2 Essence",
    "Lineage 2 Special Project",
    "обновления Lineage 2 Main",
    "обновления Lineage 2 Essence",
    "обновления Lineage 2 Special Project",
  ],
  knowledge: [
    "классы Lineage 2",
    "умения Lineage 2",
    "зоны охоты Lineage 2",
    "предметы Lineage 2",
    "билды Lineage 2",
    "фарм адены Lineage 2",
    "калькуляторы Lineage 2",
  ],
};

export const categorySeo: Record<ArticleCategory, { label: string; title: string; description: string; keywords: string[] }> = {
  news: {
    label: "Новости",
    title: "Новости",
    description: "Свежие новости Lineage 2: анонсы, события, серверы, технические работы и важные изменения игры.",
    keywords: ["Lineage 2 новости", "новости серверов Lineage 2", "события Lineage 2"],
  },
  updates: {
    label: "Обновления",
    title: "Обновления и патчноуты",
    description: "Обновления и патчноуты Lineage 2: переводы корейских изменений, разбор новых механик, классов, зон и предметов.",
    keywords: ["Lineage 2 обновления", "Lineage 2 патчноуты", "корейские патчноуты Lineage 2"],
  },
  guides: {
    label: "Гайды",
    title: "Гайды",
    description: "Практические гайды по Lineage 2: развитие персонажа, экипировка, фарм, PvE, PvP и советы новичкам.",
    keywords: ["Lineage 2 гайды", "гайды для новичков Lineage 2", "развитие персонажа Lineage 2"],
  },
  classes: {
    label: "Классы",
    title: "Классы и билды",
    description: "Классы Lineage 2: выбор профессии, сильные и слабые стороны, билды, характеристики и роль в PvE и PvP.",
    keywords: ["классы Lineage 2", "лучший класс Lineage 2", "билды Lineage 2"],
  },
  skills: {
    label: "Умения",
    title: "Умения классов",
    description: "Умения классов Lineage 2: эффекты, уровни изучения, стоимость, приоритет прокачки и изменения навыков.",
    keywords: ["умения Lineage 2", "навыки Lineage 2", "прокачка умений Lineage 2"],
  },
  zones: {
    label: "Зоны охоты",
    title: "Зоны охоты",
    description: "Зоны охоты Lineage 2: рекомендуемые уровни, монстры, награды, требования и эффективность фарма.",
    keywords: ["зоны охоты Lineage 2", "где фармить в Lineage 2", "локации Lineage 2"],
  },
  items: {
    label: "Предметы",
    title: "Предметы и экипировка",
    description: "Предметы Lineage 2: характеристики экипировки, ресурсы, способы получения, улучшение и сравнение.",
    keywords: ["предметы Lineage 2", "экипировка Lineage 2", "улучшение предметов Lineage 2"],
  },
  comparisons: {
    label: "Сравнения",
    title: "Сравнения классов и предметов",
    description: "Сравнения в Lineage 2: классы, сборки, предметы, фарм и игровые показатели на практических тестах.",
    keywords: ["сравнение классов Lineage 2", "сравнение предметов Lineage 2", "тест фарма Lineage 2"],
  },
  calculators: {
    label: "Калькуляторы",
    title: "Калькуляторы",
    description: "Калькуляторы Lineage 2 для расчёта заточки, стоимости развития, фарма, опыта и характеристик персонажа.",
    keywords: ["калькулятор Lineage 2", "расчёт заточки Lineage 2", "калькулятор фарма Lineage 2"],
  },
};

export const editionSeo: Record<ArticleEdition, { label: string; shortLabel: string; description: string; keywords: string[] }> = {
  main: {
    label: "Lineage 2 Main",
    shortLabel: "Main",
    description: "Материалы по классической версии Lineage 2 Main: новости, обновления, гайды и база знаний.",
    keywords: ["Lineage 2 Main", "Lineage 2 Main новости", "Lineage 2 Main гайды"],
  },
  essence: {
    label: "Lineage 2 Essence и Special Project",
    shortLabel: "Essence / Special Project",
    description: "Материалы по Lineage 2 Essence и Special Project с отдельными пометками различий между серверами.",
    keywords: ["Lineage 2 Essence", "Lineage 2 Special Project", "Lineage 2 Essence гайды"],
  },
  "special-project": {
    label: "Lineage 2 Special Project",
    shortLabel: "Special Project",
    description: "Новости, обновления и гайды по серверам Lineage 2 Special Project.",
    keywords: ["Lineage 2 Special Project", "Lineage 2 Eva", "Lineage 2 Wolf"],
  },
};

export const allSeoKeywords = [...semanticCore.primary, ...semanticCore.editions, ...semanticCore.knowledge];

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function articleSeoTitle(title: string, edition: ArticleEdition) {
  const game = edition === "main" ? "Lineage 2 Main" : edition === "special-project" ? "Lineage 2 Special Project" : "Lineage 2 Essence";
  const suffix = ` | ${game} – RedPlay`;
  const clean = title.replace(/\s*[|–-]\s*(?:Lineage 2.*?)?(?:RedPlay)?\s*$/i, "").trim();
  const available = Math.max(34, 72 - suffix.length);
  const shortened = clean.length > available ? `${clean.slice(0, available - 1).trimEnd()}…` : clean;
  return `${shortened}${suffix}`;
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
