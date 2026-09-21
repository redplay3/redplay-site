import HomePage, { type PublishedArticle } from "./home-client";
import { createPublicClient } from "@/lib/supabase/public";

// Articles are edited directly in Supabase, outside Next.js' cache lifecycle.
// Keep the homepage data-driven so a newly published article updates the hero,
// edition filters and cards immediately instead of waiting for a stale ISR page.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const supabase = createPublicClient();
  const { data } = supabase
    ? await supabase
        .from("articles")
        .select("id,title,description,label,cover,edition,category,slug,tags,published_at,updated_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(20)
    : { data: null };

  return <HomePage initialArticles={(data || []) as PublishedArticle[]} />;
}
