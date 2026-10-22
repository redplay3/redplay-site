"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, X, ArrowUpRight } from "lucide-react";
import { articleCategories, buildArticlePath } from "@/lib/articles/catalog";
import type { ArticleCategory, ArticleEdition } from "@/lib/articles/types";
import styles from "@/app/lineage-2/publications/publications.module.css";

export type CatalogArticle = {
  id: string; title: string; description: string; edition: ArticleEdition;
  category: ArticleCategory; slug: string; published_at: string | null; updated_at: string;
  cover?: { src?: string; alt?: string } | null; tags?: string[] | null;
};
type Filters = { q: string; edition: string; category: string };
const empty: Filters = { q: "", edition: "all", category: "all" };
const editions = [{ value: "all", label: "Все версии" }, { value: "main", label: "Main" }, { value: "essence", label: "Essence" }, { value: "special-project", label: "Special Project" }];
const categoryLabels = Object.fromEntries(articleCategories.map(c => [c.value, c.label]));
const shortTitles: Record<string, string> = {
  "forged-in-battle-21-oktyabrya-2026-bylo-stalo": "Forged in Battle: было — стало",
  "nox-othell-novyy-klass": "Нокс Одала / Othell Nox",
  "atribut-stihiy": "Атрибут стихий: гайд и калькулятор",
  "lineage-2-korea-update-2026-10-07": "BASIC и Повелитель Барц",
  "berserk-tyrr-doombringer-replica": "Берсерк после Replica",
  "lineage-2-main-7-klassov-prokachka-105": "Кого качать до 105 уровня",
  "aden-rune-kem-startovat-tier-klassov": "Кем стартовать на Aden и Rune",
  "samurai-guide-2026": "Самурай: полный гайд",
  "obnovlenie-16-sentyabrya-2026-polkovodets-avangard": "Полководец и Авангард: обновление",
  "iskatel-udachi-forged-in-battle": "Искатель Удачи в Forged in Battle",
  "maestro-forged-in-battle": "Маэстро в Forged in Battle",
  "forged-in-battle-vse-klassy-i-umeniya": "Forged in Battle: классы и умения",
};
function targets(article: CatalogArticle): string[] {
  if (article.edition === "main") return ["main"];
  const tags = article.tags || [];
  const versions = [...(tags.includes("Essence") ? ["essence"] : []), ...(tags.includes("Special Project") ? ["special-project"] : [])];
  return versions.length ? versions : [article.edition];
}
function version(article: CatalogArticle) {
  return targets(article).map(v => v === "main" ? "Main" : v === "essence" ? "Essence" : "Special").join(" + ");
}
function title(article: CatalogArticle) {
  return article.tags?.find(t => t.startsWith("Карточка: "))?.slice(10).trim() || shortTitles[article.slug] || article.title;
}
function fromLocation(): Filters {
  const params = new URLSearchParams(window.location.search);
  const ed = params.get("edition") || "all", category = params.get("category") || "all";
  return { q: params.get("q") || "", edition: editions.some(e => e.value === ed) ? ed : "all", category: articleCategories.some(c => c.value === category) ? category : "all" };
}
function Cover({ article, priority = false }: { article: CatalogArticle; priority?: boolean }) {
  const fallback = `/game-${article.edition === "special-project" ? "special" : article.edition}.webp`;
  const [failed, setFailed] = useState(false);
  const src = !failed && article.cover?.src ? article.cover.src : fallback;
  return <Image src={src} alt="" fill sizes={priority ? "(max-width: 700px) 100vw, 65vw" : "(max-width: 700px) 30vw, 260px"} priority={priority} onError={() => setFailed(true)}/>;
}
function DateLabel({ article }: { article: CatalogArticle }) {
  const date = article.published_at || article.updated_at;
  return <time dateTime={date}>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Kyiv" }).format(new Date(date))}</time>;
}
function Story({ article, variant }: { article: CatalogArticle; variant: "lead" | "side" | "row" }) {
  const Heading = variant === "row" ? "h3" : "h2";
  return <article className={`${styles.story} ${styles[variant]}`} data-story-id={article.id}>
    <Link href={buildArticlePath(article.edition, article.category, article.slug)} className={styles.storyLink} aria-label={article.title}>
      <div className={styles.cover}><Cover article={article} priority={variant === "lead"}/></div>
      <div className={styles.storyCopy}>
        <div className={styles.meta}><span>{version(article)}</span><span>{categoryLabels[article.category]}</span></div>
        <Heading title={article.title}>{title(article)}</Heading>
        {variant !== "side" && <p>{article.description}</p>}
        <div className={styles.storyBottom}><DateLabel article={article}/><ArrowUpRight size={19} aria-hidden="true"/></div>
      </div>
    </Link>
  </article>;
}

export function PublicationsCatalog({ articles }: { articles: CatalogArticle[] }) {
  const [filters, setFilters] = useState<Filters>(empty);
  useEffect(() => {
    const sync = () => setFilters(fromLocation());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    const url = new URL(window.location.href);
    for (const key of ["q", "edition", "category"] as const) {
      if (next[key] && next[key] !== "all") url.searchParams.set(key, next[key]);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url);
  }
  const filtered = useMemo(() => {
    const terms = filters.q.toLocaleLowerCase("ru").replaceAll("ё", "е").trim().split(/\s+/).filter(Boolean);
    return articles.filter(article => {
      if (filters.edition !== "all" && !targets(article).includes(filters.edition)) return false;
      if (filters.category !== "all" && article.category !== filters.category) return false;
      const text = `${article.title} ${article.description} ${(article.tags || []).join(" ")}`.toLocaleLowerCase("ru").replaceAll("ё", "е");
      return terms.every(term => text.includes(term));
    });
  }, [articles, filters]);
  const active = filters.q.trim() || filters.edition !== "all" || filters.category !== "all";
  const featured = articles.find(article => article.tags?.includes("Главный материал")) || articles[0];
  const opening = featured ? [featured, ...articles.filter(a => a.id !== featured.id).slice(0, 2)] : [];
  const openingIds = new Set(opening.map(a => a.id));
  const archive = active ? filtered : articles.filter(a => !openingIds.has(a.id));
  const availableCategories = articleCategories.filter(c => articles.some(a => a.category === c.value));

  return <>
    <div className={styles.tools} data-ui>
      <div className={styles.toolTop}>
        <div className={styles.editions} role="group" aria-label="Версия игры">{editions.map(e => <button key={e.value} type="button" aria-pressed={filters.edition === e.value} onClick={() => update({ edition: e.value })}>{e.label}</button>)}</div>
        <div className={styles.search}><Search size={19} aria-hidden="true"/><input aria-label="Поиск публикаций" type="search" placeholder="Название, класс или умение" value={filters.q} onChange={e => update({ q: e.target.value })}/>{filters.q && <button aria-label="Очистить поиск" type="button" onClick={() => update({ q: "" })}><X size={17}/></button>}</div>
      </div>
      <div className={styles.toolBottom}><label>Тема <select aria-label="Тема публикаций" value={filters.category} onChange={e => update({ category: e.target.value })}><option value="all">Все темы</option>{availableCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label><span className={styles.resultCount} aria-live="polite">{filtered.length} из {articles.length} материалов</span>{active && <button className={styles.reset} onClick={() => update(empty)}>Сбросить фильтры</button>}</div>
    </div>
    {!active && opening.length > 0 && <section className={styles.opening} aria-label="Свежие публикации"><Story article={opening[0]} variant="lead"/><div className={styles.sideStack}>{opening.slice(1).map(a => <Story key={a.id} article={a} variant="side"/>)}</div></section>}
    <section className={styles.archive} aria-labelledby="archive-title"><div className={styles.archiveHeading}><h2 id="archive-title">{active ? "Результаты поиска" : "Ещё почитать"}</h2><span>Сначала новые</span></div>
      {archive.length > 0 ? <div key={`${filters.edition}:${filters.category}:${filters.q}`} className={styles.storyList}>{archive.map(a => <Story key={a.id} article={a} variant="row"/>)}</div> : <div className={styles.empty}><h3>{active ? "Ничего не найдено" : "Вы уже видите все материалы"}</h3><p>{active ? "Попробуй другое название или выбери все версии игры." : "Новые публикации появятся здесь после выхода."}</p>{active && <button onClick={() => update(empty)}>Показать все публикации</button>}</div>}
    </section>
  </>;
}

