import { createPublicClient } from "@/lib/supabase/public";

export async function getArticleViewCount(pageKey: string) {
  const supabase = createPublicClient();
  if (!supabase) return 0;

  const { data } = await supabase
    .from("article_views")
    .select("view_count")
    .eq("page_key", pageKey)
    .maybeSingle();

  return Number(data?.view_count || 0);
}
