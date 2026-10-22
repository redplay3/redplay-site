import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-provider";
import { PublicationsCatalog, type CatalogArticle } from "@/components/publications-catalog";
import { createPublicClient } from "@/lib/supabase/public";
import styles from "./publications.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Все публикации Lineage 2",
  description: "Все свежие публикации RedPlay по Lineage 2 Main, Essence и Special Project.",
  alternates: { canonical: "/lineage-2/publications" },
};

const localFallback: CatalogArticle[] = [
  { id: "samurai", title: "Самурай в Lineage 2 Essence — полный гайд 2026", description: "Навыки, прокачка, PvE, PvP, экипировка и развитие класса.", edition: "essence", category: "classes", slug: "samurai-guide-2026", published_at: "2026-09-19T19:22:25.161+00:00", updated_at: "2026-09-20T10:32:43.26878+00:00" },
  { id: "update-16", title: "Обновление Lineage 2 Essence от 16 сентября: Полководец, Авангард", description: "Классы, навыки, таблицы, события и другие изменения корейского патчноута.", edition: "essence", category: "updates", slug: "obnovlenie-16-sentyabrya-2026-polkovodets-avangard", published_at: "2026-09-16T18:33:26.31+00:00", updated_at: "2026-09-16T19:57:07.973029+00:00" },
  { id: "fortune", title: "Искатель Удачи в Forged in Battle: все умения, Spoil и Lucky Box", description: "Новая боевая модель, ключевые умения, Rolling Dice, Spoil Destroyer и Lucky Box.", edition: "essence", category: "classes", slug: "iskatel-udachi-forged-in-battle", published_at: "2026-09-14T18:46:31.823+00:00", updated_at: "2026-09-14T18:46:31.67525+00:00" },
  { id: "maestro", title: "Маэстро в Forged in Battle: все умения, крафт и Broken Armor", description: "Новые молоты и парные мечи, Broken Armor, Prime Maestro, выживание и ремесло.", edition: "essence", category: "classes", slug: "maestro-forged-in-battle", published_at: "2026-09-14T18:45:28.274+00:00", updated_at: "2026-09-14T18:45:28.122159+00:00" },
];

async function getArticles() {
  const supabase = createPublicClient();
  if (!supabase) return localFallback;
  const articles: CatalogArticle[] = [];
  // Fetch the full public archive; stable ordering also covers equal publication dates.
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await supabase.from("articles")
      .select("id,title,description,edition,category,slug,published_at,updated_at,cover,tags")
      .eq("status", "published").lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false }).order("id")
      .range(offset, offset + 199);
    if (error) return localFallback;
    articles.push(...data as CatalogArticle[]);
    if (data.length < 200) return articles;
  }
}

export default async function PublicationsPage() {
  const articles = await getArticles();
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.wrap}><Link href="/" className="article-logo" aria-label="RedPlay — главная"><span className="redplay-mark small">R</span><strong>REDPLAY</strong></Link><Link href="/" className={styles.back}><ArrowLeft size={16}/> На главную</Link><ThemeSwitcher/></div></header>
    <div className={styles.wrap}>
      <div className={styles.intro}><h1>Все публикации</h1><p>Обновления, классы и гайды по Lineage 2.</p></div>
      <PublicationsCatalog articles={articles}/>
      <footer className={styles.footer}><Link href="/">REDPLAY</Link><p>Читай. Проверяй. Играй.</p><a href="https://t.me/redplay2022" target="_blank" rel="noopener noreferrer">Новости в Telegram ↗</a></footer>
    </div>
  </main>;
}

