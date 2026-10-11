import document from "@/content/guides/attribute-page.json";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// This standalone guide preserves the reviewed equipment calculator and layout.
// Its catalogue record controls publication, just like other articles.
export async function GET() {
  const supabase = createPublicClient();
  if (!supabase) return new Response("Статья временно недоступна", { status: 503 });
  const { data, error } = await supabase.from("articles")
    .select("id")
    .eq("edition", "main")
    .eq("category", "guides")
    .eq("slug", "atribut-stihiy")
    .eq("status", "published")
    .maybeSingle();
  if (error) return new Response("Статья временно недоступна", { status: 503 });
  if (!data) return new Response("Статья не найдена", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
  return new Response(document.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
