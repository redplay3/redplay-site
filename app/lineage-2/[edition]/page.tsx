import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight, Database } from "lucide-react";
import { notFound } from "next/navigation";
import { articleCategories, buildArticlePath } from "@/lib/articles/catalog";
import type { ArticleCategory, ArticleEdition } from "@/lib/articles/types";
import { absoluteUrl, categorySeo, editionSeo, safeJsonLd, SITE_URL } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { ThemeSwitcher } from "@/components/theme-provider";

export const revalidate = 300;

type Params = { edition: string };
type CatalogArticle = { id: string; title: string; description: string; edition: ArticleEdition; category: ArticleCategory; slug: string; published_at: string | null; updated_at: string };

function validEdition(value: string): value is ArticleEdition {
  return value === "main" || value === "essence" || value === "special-project";
}

async function getArticles(edition: ArticleEdition) {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const editions = edition === "essence" ? ["essence", "special-project"] : [edition];
  const { data } = await supabase.from("articles").select("id,title,description,edition,category,slug,published_at,updated_at").eq("status", "published").in("edition", editions).order("published_at", { ascending: false }).limit(30);
  return (data || []) as CatalogArticle[];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { edition } = await params;
  if (!validEdition(edition)) return {};
  const info = editionSeo[edition];
  const title = `${info.label}: новости, гайды и база знаний | RedPlay`;
  return {
    title: { absolute: title },
    description: info.description,
    keywords: info.keywords,
    alternates: { canonical: `/lineage-2/${edition}` },
    openGraph: { type: "website", locale: "ru_RU", url: `/lineage-2/${edition}`, siteName: "RedPlay", title, description: info.description, images: [{ url: edition === "main" ? "/game-main.webp" : "/game-essence.webp", alt: info.label }] },
    twitter: { card: "summary_large_image", title, description: info.description, images: [edition === "main" ? "/game-main.webp" : "/game-essence.webp"] },
  };
}

export default async function EditionPage({ params }: { params: Promise<Params> }) {
  const { edition: rawEdition } = await params;
  if (!validEdition(rawEdition)) notFound();
  const info = editionSeo[rawEdition];
  const articles = await getArticles(rawEdition);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", name: info.label, description: info.description, url: absoluteUrl(`/lineage-2/${rawEdition}`), inLanguage: "ru-RU", isPartOf: { "@id": `${SITE_URL}/#website` } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: info.label, item: absoluteUrl(`/lineage-2/${rawEdition}`) },
      ] },
    ],
  };

  return <main className="catalog-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}/>
    <header className="catalog-header"><div className="catalog-wrap"><Link href="/" className="article-logo"><span className="redplay-mark small">R</span><strong>REDPLAY</strong></Link><Link href="/" className="catalog-back"><ArrowLeft size={16}/> На главную</Link><ThemeSwitcher className="catalog-theme-switcher"/></div></header>
    <section className="catalog-hero"><div className="catalog-wrap"><div className="article-breadcrumb"><Link href="/">Главная</Link><ChevronRight size={14}/><span>{info.shortLabel}</span></div><p className="catalog-kicker">База знаний RedPlay</p><h1>{info.label}</h1><p>{info.description}</p><div className="catalog-tags">{info.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div></section>
    <div className="catalog-wrap catalog-content">
      <section><div className="catalog-title"><Database size={19}/><div><span>Выбери тему</span><h2>Разделы {info.shortLabel}</h2></div></div><div className="catalog-categories">{articleCategories.map((category) => <Link key={category.value} href={`/lineage-2/${rawEdition}/${category.value}`}><small>{categorySeo[category.value].keywords[0]}</small><strong>{categorySeo[category.value].title}</strong><p>{categorySeo[category.value].description}</p><span>Открыть <ArrowRight size={14}/></span></Link>)}</div></section>
      <section><div className="catalog-title"><div><span>Последние публикации</span><h2>Новые материалы</h2></div></div>{articles.length ? <div className="catalog-articles">{articles.map((article) => <Link key={article.id} href={buildArticlePath(article.edition, article.category, article.slug)}><span>{categorySeo[article.category].label}</span><h3>{article.title}</h3><p>{article.description}</p><small>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(article.published_at || article.updated_at))}</small></Link>)}</div> : <div className="catalog-empty">Первый материал уже готовится. Пока выбери нужный раздел базы знаний.</div>}</section>
    </div>
  </main>;
}
