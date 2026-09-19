import { redirect } from "next/navigation";
import { ArticleEditor } from "@/components/admin/article-editor";
import { createClient } from "@/lib/supabase/server";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default async function NewArticlePage() {
  const supabase = await createClient();
  if (!supabase) redirect("/redplay-admin");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/redplay-admin/login");
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) redirect("/redplay-admin/login");

  return <main className="admin-shell"><AdminTopbar/><div className="admin-wrap"><div className="admin-head"><div><h1>Новый материал</h1><p>Собери публикацию из фирменных блоков RedPlay и проверь её до публикации.</p></div></div><ArticleEditor/></div></main>;
}

