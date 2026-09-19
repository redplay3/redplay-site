import type { MetadataRoute } from "next";
import { articleCategories } from "@/lib/articles/catalog";
import type { ArticleCategory, ArticleEdition } from "@/lib/articles/types";
import { SITE_URL } from "@/lib/seo";
import { redplayTests } from "@/lib/tests/data";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 300;

type SitemapArticle = {
  edition: ArticleEdition;
  category: ArticleCategory;
  slug: string;
  published_at: string | null;
  updated_at: string;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/lineage-2/main/updates/replica`, lastModified: new Date("2026-09-12"), changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/lineage-2/tests`, changeFrequency: "weekly", priority: 0.85 },
    ...redplayTests.filter((test) => test.status === "published").map((test) => ({ url: `${SITE_URL}/lineage-2/tests/${test.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];

  for (const edition of ["main", "essence"] as const) {
    entries.push({
      url: `${SITE_URL}/lineage-2/${edition}`,
      changeFrequency: "daily",
      priority: 0.8,
    });
    for (const category of articleCategories) {
      entries.push({
        url: `${SITE_URL}/lineage-2/${edition}/${category.value}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  const supabase = createPublicClient();
  if (!supabase) return entries;
  const { data } = await supabase
    .from("articles")
    .select("edition,category,slug,published_at,updated_at")
    .eq("status", "published")
    .order("updated_at", { ascending: false });

  for (const article of (data || []) as SitemapArticle[]) {
    const url = `${SITE_URL}/lineage-2/${article.edition}/${article.category}/${article.slug}`;
    const existing = entries.find((entry) => entry.url === url);
    if (existing) continue;
    entries.push({
      url,
      lastModified: new Date(article.updated_at || article.published_at || Date.now()),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return entries;
}
