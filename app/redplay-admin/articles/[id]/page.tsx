import { notFound, redirect } from "next/navigation";
import { ArticleEditor } from "@/components/admin/article-editor";
import { createClient } from "@/lib/supabase/server";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) redirect("/redplay-admin");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/redplay-admin/login");
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) redirect("/redplay-admin/login");
  const { data: article } = await supabase.from("articles").select("*").eq("id", id).single();
  if (!article) notFound();

  return <main className="admin-shell"><AdminTopbar/><div className="admin-wrap"><div className="admin-head"><div><h1>Редактирование</h1><p>Изменения сохраняются в истории, поэтому предыдущую версию можно будет восстановить.</p></div></div><ArticleEditor initial={article}/></div></main>;
}

