import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Bell, CalendarDays, ChevronRight, Clock3, Send, Video as Youtube } from "lucide-react";
import { ArticleBlockRenderer } from "@/components/article-block-renderer";
import { ArticleSharePanel, ArticleViewCount } from "@/components/article-engagement";
import { ArticleAudienceContent } from "@/components/article-audience-content";
import { ArticleNavigation } from "@/components/article-navigation";
import { RememberEditionPreference } from "@/components/remember-edition-preference";
import { articleCategories, articleEditions } from "@/lib/articles/catalog";
import { getArticleViewCount } from "@/lib/articles/views";
import type { ArticleCategory, ArticleEdition, ArticleIcon, ArticleSection } from "@/lib/articles/types";
import { absoluteUrl, articleSeoTitle, categorySeo, editionSeo, safeJsonLd, SITE_URL } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

type Params = { edition: string; category: string; slug: string };
type ArticleRow = {
  id: string;
  edition: ArticleEdition;
  category: ArticleCategory;
  slug: string;
  title: string;
  description: string;
  label: string;
  cover: { src?: string; alt?: string } | null;
  tags: string[] | null;
  highlights: Array<{ icon: ArticleIcon; value: string; label: string }> | null;
  content: ArticleSection[] | null;
  published_at: string | null;
  updated_at: string;
  seo: { title?: string; description?: string; keywords?: string[] } | null;
};

const playLinks: Record<ArticleEdition, string> = {
  main: "https://ru.4game.com/s2s/lineage2_RedPlay",
  essence: "https://4ga.me/3m0Ho3F",
  "special-project": "https://ru.4game.com/s2s/redplay_eva",
};

const fallbackCovers: Record<ArticleEdition, string> = {
  main: "/game-main.webp",
  essence: "/game-essence.webp",
  "special-project": "/game-special.webp",
};

async function getArticle(params: Params) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("articles").select("id,edition,category,slug,title,description,label,cover,tags,highlights,content,published_at,updated_at,seo").eq("edition", params.edition).eq("category", params.category).eq("slug", params.slug).eq("status", "published").maybeSingle();
  return data as ArticleRow | null;
}

function formatDate(value: string | null) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value || Date.now()));
}

function readingTime(sections: ArticleSection[]) {
  const words = JSON.stringify(sections).replace(/[{}\[\]":,]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.ceil(words / 180));
}

function formatReadingTime(minutes: number) {
  if (minutes < 90) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolved = await params;
  const article = await getArticle(resolved);
  if (!article) return { title: "Материал не найден | RedPlay" };
  const canonical = `/lineage-2/${article.edition}/${article.category}/${article.slug}`;
  const titleSource = article.seo?.title?.trim() || article.title;
  const title = /redplay/i.test(titleSource) ? titleSource : articleSeoTitle(titleSource, article.edition);
  const description = article.seo?.description?.trim() || article.description;
  const cover = article.cover?.src || fallbackCovers[article.edition];
  const keywords = [...new Set([...(article.seo?.keywords || []), ...(article.tags || []), ...editionSeo[article.edition].keywords, ...categorySeo[article.category].keywords])];
  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      type: "article",
      locale: "ru_RU",
      url: canonical,
      siteName: "RedPlay",
      title,
      description,
      publishedTime: article.published_at || undefined,
      modifiedTime: article.updated_at,
      tags: keywords,
      images: [{ url: cover, alt: article.cover?.alt || article.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [cover] },
  };
}

export default async function PublishedArticlePage({ params }: { params: Promise<Params> }) {
  const resolved = await params;
  const article = await getArticle(resolved);
  if (!article) notFound();

  const sections = article.content || [];
  const edition = articleEditions.find((item) => item.value === article.edition)?.label || article.edition;
  const category = articleCategories.find((item) => item.value === article.category)?.label || article.category;
  const taggedTargets = (article.tags || []).filter((tag) => tag === "Essence" || tag === "Special Project");
  const articleTargets: ArticleEdition[] = article.edition === "main" ? ["main"] : taggedTargets.length ? taggedTargets.map((tag) => tag === "Essence" ? "essence" : "special-project") : [article.edition];
  const audienceTargets = articleTargets.filter((target): target is "essence" | "special-project" => target !== "main");
  const cover = article.cover?.src || fallbackCovers[article.edition];
  const toc = sections.map((section) => ({ id: section.id, label: section.label }));
  const canonicalPath = `/lineage-2/${article.edition}/${article.category}/${article.slug}`;
  const initialViews = await getArticleViewCount(canonicalPath);
  const categoryPath = `/lineage-2/${article.edition}/${article.category}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${absoluteUrl(canonicalPath)}#article`,
        headline: article.title,
        description: article.description,
        image: [absoluteUrl(cover)],
        datePublished: article.published_at || article.updated_at,
        dateModified: article.updated_at,
        mainEntityOfPage: absoluteUrl(canonicalPath),
        articleSection: category,
        keywords: [...new Set([...(article.seo?.keywords || []), ...(article.tags || [])])].join(", "),
        inLanguage: "ru-RU",
        author: { "@type": "Organization", name: "RedPlay", url: SITE_URL },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: edition, item: absoluteUrl(`/lineage-2/${article.edition}`) },
          { "@type": "ListItem", position: 3, name: category, item: absoluteUrl(categoryPath) },
          { "@type": "ListItem", position: 4, name: article.title, item: absoluteUrl(canonicalPath) },
        ],
      },
    ],
  };

  return <main className="article-page">
    <RememberEditionPreference edition={article.edition}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}/>
    <header className="article-header"><div className="mx-auto flex h-[68px] max-w-[1460px] items-center gap-5 px-4 sm:px-6 lg:px-8">
      <Link href="/" className="article-logo"><span className="redplay-mark small">R</span><strong>REDPLAY</strong></Link>
      <span className="hidden h-6 w-px bg-white/12 sm:block"/>
      <Link href="/" className="article-back"><ArrowLeft size={16}/> На главную</Link>
      <Link href={categoryPath} className="ml-auto hidden text-sm font-bold text-white/55 md:block">{category} · {edition}</Link>
      <span className="article-play-group">{articleTargets.map((target) => <a key={target} href={playLinks[target]} target="_blank" rel="sponsored noopener noreferrer" className="article-play">{target === "main" ? "Играть в Main" : target === "essence" ? "Играть в Essence" : "Играть в Special"} <ArrowUpRight size={15}/></a>)}</span>
    </div></header>

    <section className="article-hero">
      <img src={cover} alt="" className="article-hero-backdrop" aria-hidden="true"/>
      <img src={cover} alt={article.cover?.alt || article.title} className="article-hero-image"/><div className="article-hero-shade"/>
      <div className="relative z-10 mx-auto flex min-h-[600px] max-w-[1460px] items-end px-4 pb-12 pt-28 sm:px-6 lg:px-8 lg:pb-14"><div className="max-w-5xl">
        <div className="article-breadcrumb"><Link href="/">Главная</Link><ChevronRight size={14}/><Link href={categoryPath}>{edition}</Link><ChevronRight size={14}/><Link href={categoryPath}>{category}</Link></div>
        <div className="mt-7 flex flex-wrap items-center gap-3"><span className="article-label">{article.label || category}</span><span className="article-meta"><CalendarDays size={14}/> {formatDate(article.published_at)}</span><span className="article-meta"><Clock3 size={14}/> {formatReadingTime(readingTime(sections))}</span><ArticleViewCount pageKey={canonicalPath} initialViews={initialViews}/></div>
        <h1>{article.title}</h1><p className="article-deck">{article.description}</p>
      </div></div>
    </section>

    {!!article.highlights?.length && <section className="article-highlights"><div className="mx-auto grid max-w-[1460px] grid-cols-2 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">{article.highlights.map((item) => <div key={`${item.value}-${item.label}`} className="highlight-stat"><div><strong>{item.value}</strong><span>{item.label}</span></div></div>)}</div></section>}

    <div className="mx-auto grid max-w-[1460px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[230px_minmax(0,820px)_240px] lg:px-8 lg:py-16">
      <ArticleNavigation items={toc}/>
      <article className="article-body">
        <div className="article-status"><span><Bell size={16}/> {article.label || "Материал RedPlay"}</span><p>Обновлено: {formatDate(article.updated_at)}</p><a href="https://t.me/redplay2022" target="_blank" rel="noopener noreferrer">Следить в Telegram <ArrowUpRight size={14}/></a></div>
        {article.edition === "main"
          ? sections.map((section, index) => <section id={section.id} key={section.id}>{index > 0 && <div className="article-block-heading"><span className="article-section-number">{String(index + 1).padStart(2, "0")}</span><h2>{section.label}</h2></div>}<ArticleBlockRenderer blocks={section.blocks}/></section>)
          : <ArticleAudienceContent sections={sections} targets={audienceTargets} articleSlug={article.slug}/>
        }
        <ArticleSharePanel title={article.title}/>
        <section className="article-next">
          <div className="article-next-head"><span>Продолжить с RedPlay</span><h2>Выбери следующий шаг</h2><p>Открой другие материалы раздела, посмотри разборы или получай быстрые новости.</p></div>
          <div className="article-next-primary">
            <Link className="next-section" href={categoryPath}><Bell size={24}/><span><small>{edition}</small><strong>Все материалы: {category}</strong></span><ArrowUpRight size={17}/></Link>
            <a className="next-youtube" href="https://www.youtube.com/@iRedP" target="_blank" rel="noopener noreferrer"><Youtube size={24}/><span><small>YouTube</small><strong>Видео и живые разборы</strong></span><ArrowUpRight size={17}/></a>
            <a className="next-telegram" href="https://t.me/redplay2022" target="_blank" rel="noopener noreferrer"><Send size={24}/><span><small>Telegram</small><strong>Новости и обсуждение</strong></span><ArrowUpRight size={17}/></a>
          </div>
          <div className="article-next-games">{articleTargets.map((target) => <a key={target} className="next-game" href={playLinks[target]} target="_blank" rel="sponsored noopener noreferrer"><img src={fallbackCovers[target]} alt=""/><span className="next-game-shade"/><span><small>Lineage 2 {target === "main" ? "Main" : target === "essence" ? "Essence" : "Special Project"}</small><strong>Бонусы новым и вернувшимся игрокам</strong></span><ArrowUpRight size={17}/></a>)}</div>
        </section>
      </article>
      <aside className="article-side"><div className="article-side-card"><span>Lineage 2 {edition}</span><strong>Начни с бонусом RedPlay</strong><p>Бонус для новых и вернувшихся игроков.</p>{articleTargets.map((target) => <a key={target} href={playLinks[target]} target="_blank" rel="sponsored noopener noreferrer">{target === "main" ? "Играть в Main" : target === "essence" ? "Играть в Essence" : "Играть в Special"} <ArrowUpRight size={15}/></a>)}</div><a className="article-social" href="https://www.youtube.com/@iRedP" target="_blank" rel="noopener noreferrer">Разборы на YouTube <ArrowUpRight size={15}/></a><a className="article-social" href="https://t.me/redplay2022" target="_blank" rel="noopener noreferrer">Новости в Telegram <ArrowUpRight size={15}/></a></aside>
    </div>
    <footer className="article-footer"><div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-9 text-sm text-white/38 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><div className="flex items-center gap-3"><span className="redplay-mark small">R</span><strong className="text-white">REDPLAY</strong><span>Игровой портал</span></div><div className="flex gap-5"><a href="https://www.youtube.com/@iRedP" target="_blank" rel="noopener noreferrer">YouTube</a><a href="https://t.me/redplay2022" target="_blank" rel="noopener noreferrer">Telegram</a></div><p>Lineage II – товарный знак NCSOFT.</p></div></footer>
  </main>;
}

