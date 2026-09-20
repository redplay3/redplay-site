import HomePage, { type PublishedArticle } from "./home-client";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 300;

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
