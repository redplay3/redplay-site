import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Newspaper } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-provider";
import { articleCategories, buildArticlePath } from "@/lib/articles/catalog";
import type { ArticleCategory, ArticleEdition } from "@/lib/articles/types";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Все публикации Lineage 2",
  description: "Все свежие публикации RedPlay по Lineage 2 Main, Essence и Special Project.",
  alternates: { canonical: "/lineage-2/publications" },
};

type CatalogArticle = {
  id: string;
  title: string;
  description: string;
  edition: ArticleEdition;
  category: ArticleCategory;
  slug: string;
  published_at: string | null;
  updated_at: string;
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
  const { data } = await supabase.from("articles").select("id,title,description,edition,category,slug,published_at,updated_at").eq("status", "published").order("published_at", { ascending: false }).limit(60);
  return data?.length ? data as CatalogArticle[] : localFallback;
}

export default async function PublicationsPage() {
  const articles = await getArticles();
  return <main className="catalog-page">
    <header className="catalog-header"><div className="catalog-wrap"><Link href="/" className="article-logo"><span className="redplay-mark small">R</span><strong>REDPLAY</strong></Link><Link href="/" className="catalog-back"><ArrowLeft size={16}/> На главную</Link><ThemeSwitcher className="catalog-theme-switcher"/></div></header>
    <section className="catalog-hero"><div className="catalog-wrap"><div className="article-breadcrumb"><Link href="/">Главная</Link><ChevronRight size={14}/><span>Все публикации</span></div><p className="catalog-kicker">Редакция RedPlay</p><h1>Все публикации</h1><p>Новости, обновления, гайды и разборы по Lineage 2 Main, Essence и Special Project — от новых материалов к более ранним.</p><div className="catalog-tags"><span>Main</span><span>Essence</span><span>Special Project</span></div></div></section>
    <div className="catalog-wrap catalog-content"><section><div className="catalog-title"><Newspaper size={19}/><div><span>Последние материалы</span><h2>Что нового на RedPlay</h2></div></div><div className="catalog-articles">{articles.map((article) => <Link key={article.id} href={buildArticlePath(article.edition, article.category, article.slug)}><span>{articleCategories.find((item) => item.value === article.category)?.label || article.category} · {article.edition === "main" ? "Main" : article.edition === "essence" ? "Essence" : "Special Project"}</span><h3>{article.title}</h3><p>{article.description}</p><small>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(article.published_at || article.updated_at))}</small></Link>)}</div></section></div>
  </main>;
}
