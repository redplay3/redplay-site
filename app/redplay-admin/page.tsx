import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminTopbar } from "./layout";

type ArticleRow = { id: string; title: string; edition: string; category: string; slug: string; status: string; updated_at: string };

export default async function AdminHome() {
  const supabase = await createClient();
  if (!supabase) return <main className="config-missing"><h1>Подключение почти готово</h1><p>Добавь URL и публичный ключ Supabase в переменные окружения Vercel. После новой сборки здесь появится вход в редакцию.</p></main>;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/redplay-admin/login");
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) redirect("/redplay-admin/login?error=access");
  const { data } = await supabase.from("articles").select("id,title,edition,category,slug,status,updated_at").order("updated_at", { ascending: false });
  const articles = (data || []) as ArticleRow[];

  return <main className="admin-shell"><AdminTopbar/><div className="admin-wrap">
    <div className="admin-head"><div><h1>Публикации</h1><p>Черновики, запланированные и опубликованные материалы RedPlay.</p></div><Link className="admin-primary" href="/redplay-admin/articles/new"><FilePlus2 size={16}/> Новый материал</Link></div>
    {articles.length ? <div className="admin-grid">{articles.map((article) => <Link className="admin-article-row" key={article.id} href={`/redplay-admin/articles/${article.id}`}><span><strong>{article.title}</strong><small>{article.edition} / {article.category} / {article.slug}</small></span><span className={`admin-status ${article.status}`}>{article.status}</span><Pencil size={16}/></Link>)}</div> : <div className="admin-empty"><FilePlus2 size={30}/><p>Публикаций пока нет. Создай первый материал в новом редакторе.</p></div>}
  </div></main>;
}

