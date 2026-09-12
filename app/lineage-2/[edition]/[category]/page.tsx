import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { articleCategories, buildArticlePath } from "@/lib/articles/catalog";
import type { ArticleCategory, ArticleEdition } from "@/lib/articles/types";
import { absoluteUrl, categorySeo, editionSeo, safeJsonLd, SITE_URL } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 300;

type Params = { edition: string; category: string };
type CatalogArticle = { id: string; title: string; description: string; edition: ArticleEdition; category: ArticleCategory; slug: string; tags: string[] | null; published_at: string | null; updated_at: string };

function validEdition(value: string): value is ArticleEdition { return value === "main" || value === "essence" || value === "special-project"; }
function validCategory(value: string): value is ArticleCategory { return articleCategories.some((item) => item.value === value); }

async function getArticles(edition: ArticleEdition, category: ArticleCategory) {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const editions = edition === "essence" ? ["essence", "special-project"] : [edition];
  const { data } = await supabase.from("articles").select("id,title,description,edition,category,slug,tags,published_at,updated_at").eq("status", "published").eq("category", category).in("edition", editions).order("published_at", { ascending: false });
  return (data || []) as CatalogArticle[];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { edition, category } = await params;
  if (!validEdition(edition) || !validCategory(category)) return {};
  const editionInfo = editionSeo[edition];
  const categoryInfo = categorySeo[category];
  const title = `${categoryInfo.title} ${editionInfo.shortLabel} | Lineage 2 – RedPlay`;
  const description = `${categoryInfo.description} ${editionInfo.description}`;
  const keywords = [...new Set([...categoryInfo.keywords, ...editionInfo.keywords])];
  const canonical = `/lineage-2/${edition}/${category}`;
  return {
    title: { absolute: title }, description, keywords, alternates: { canonical },
    openGraph: { type: "website", locale: "ru_RU", url: canonical, siteName: "RedPlay", title, description, images: [{ url: edition === "main" ? "/game-main.webp" : "/game-essence.webp", alt: `${categoryInfo.title} ${editionInfo.label}` }] },
    twitter: { card: "summary_large_image", title, description, images: [edition === "main" ? "/game-main.webp" : "/game-essence.webp"] },
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { edition: rawEdition, category: rawCategory } = await params;
  if (!validEdition(rawEdition) || !validCategory(rawCategory)) notFound();
  const edition = editionSeo[rawEdition];
  const category = categorySeo[rawCategory];
  const articles = await getArticles(rawEdition, rawCategory);
  if (rawEdition === "main" && rawCategory === "updates" && !articles.some((article) => article.slug === "replica")) articles.unshift({ id: "replica", title: "Replica для Lineage 2 Main: межсерверные вторжения, Гора Богов и 13 новых агатионов", description: "Полный разбор обновления Replica: межсерверная игра, новые зоны, классы, предметы и подготовка к патчу.", edition: "main", category: "updates", slug: "replica", tags: ["Replica", "Гора Богов"], published_at: "2026-09-12T10:30:00+03:00", updated_at: "2026-09-12T13:30:00+03:00" });
  const canonical = `/lineage-2/${rawEdition}/${rawCategory}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", name: `${category.title} ${edition.label}`, description: `${category.description} ${edition.description}`, url: absoluteUrl(canonical), inLanguage: "ru-RU", isPartOf: { "@id": `${SITE_URL}/#website` } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: edition.label, item: absoluteUrl(`/lineage-2/${rawEdition}`) },
        { "@type": "ListItem", position: 3, name: category.title, item: absoluteUrl(canonical) },
      ] },
    ],
  };

  return <main className="catalog-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}/>
    <header className="catalog-header"><div className="catalog-wrap"><Link href="/" className="article-logo"><span className="redplay-mark small">R</span><strong>REDPLAY</strong></Link><Link href="/" className="catalog-back"><ArrowLeft size={16}/> На главную</Link></div></header>
    <section className="catalog-hero"><div className="catalog-wrap"><div className="article-breadcrumb"><Link href="/">Главная</Link><ChevronRight size={14}/><Link href={`/lineage-2/${rawEdition}`}>{edition.shortLabel}</Link><ChevronRight size={14}/><span>{category.label}</span></div><p className="catalog-kicker">{edition.label}</p><h1>{category.title}</h1><p>{category.description}</p><div className="catalog-tags">{[...new Set([...category.keywords, ...edition.keywords])].map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div></section>
    <div className="catalog-wrap catalog-content">
      <section><div className="catalog-title"><div><span>Публикации RedPlay</span><h2>Все материалы раздела</h2></div></div>{articles.length ? <div className="catalog-articles">{articles.map((article) => <Link key={article.id} href={buildArticlePath(article.edition, article.category, article.slug)}><span>{article.tags?.slice(0, 2).join(" · ") || category.label}</span><h3>{article.title}</h3><p>{article.description}</p><small>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(article.published_at || article.updated_at))}</small></Link>)}</div> : <div className="catalog-empty"><strong>Раздел уже открыт.</strong><p>Первый материал появится здесь после публикации в редакторе RedPlay.</p></div>}</section>
      <aside className="catalog-related"><span>Другие темы</span>{articleCategories.filter((item) => item.value !== rawCategory).map((item) => <Link key={item.value} href={`/lineage-2/${rawEdition}/${item.value}`}>{categorySeo[item.value].title}<ArrowRight size={14}/></Link>)}</aside>
    </div>
  </main>;
}
