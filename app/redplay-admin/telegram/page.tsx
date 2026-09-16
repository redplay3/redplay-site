import { redirect } from "next/navigation";
import { TelegramMonitorClient } from "@/components/admin/telegram-monitor";
import { createClient } from "@/lib/supabase/server";
import { AdminTopbar } from "../layout";
import "./telegram.css";

function kyivDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default async function TelegramAdminPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="config-missing"><h1>Нет подключения к Supabase</h1><p>Проверь переменные окружения проекта.</p></main>;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/redplay-admin/login");
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) redirect("/redplay-admin/login?error=access");

  const today = kyivDateKey();
  const [runResult, digestResult, feedResult] = await Promise.all([
    supabase.from("l2_ru_radar_runs").select("checked_at,ok,discovered_count,new_count,relevant_count").order("checked_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("l2_ru_telegram_digests").select("body,generated_at").eq("digest_date", today).maybeSingle(),
    supabase.from("l2_ru_feed_items").select("id,edition,category,title,source_url,relevant,published_at,first_seen_at").order("published_at", { ascending: false, nullsFirst: false }).limit(40),
  ]);

  const run = runResult.data;
  const digest = digestResult.data;
  const items = (feedResult.data || []).map((item) => ({
    id: String(item.id),
    edition: String(item.edition),
    category: String(item.category),
    title: String(item.title),
    sourceUrl: String(item.source_url),
    relevant: Boolean(item.relevant),
    publishedAt: item.published_at ? String(item.published_at) : null,
    firstSeenAt: String(item.first_seen_at),
  }));

  return <main className="admin-shell">
    <AdminTopbar/>
    <div className="admin-wrap">
      <div className="admin-head">
        <div><h1>Telegram</h1><p>Автоматический монитор публикаций Lineage 2 и подготовка короткого поста для RedPlay.</p></div>
      </div>
      <TelegramMonitorClient
        digestBody={digest?.body ? String(digest.body) : ""}
        digestGeneratedAt={digest?.generated_at ? String(digest.generated_at) : null}
        lastRun={{
          checkedAt: run?.checked_at ? String(run.checked_at) : null,
          ok: typeof run?.ok === "boolean" ? run.ok : null,
          discoveredCount: Number(run?.discovered_count || 0),
          newCount: Number(run?.new_count || 0),
          relevantCount: Number(run?.relevant_count || 0),
        }}
        items={items}
      />
    </div>
  </main>;
}
