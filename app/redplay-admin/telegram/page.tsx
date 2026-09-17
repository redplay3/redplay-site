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
  const [runResult, digestResult, feedResult, publishedResult] = await Promise.all([
    supabase.from("l2_ru_radar_runs").select("checked_at,ok,discovered_count,new_count,relevant_count").order("checked_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("l2_ru_telegram_digests").select("body,generated_at,status,item_ids,updated_at").eq("digest_date", today).maybeSingle(),
    supabase.from("l2_ru_feed_items").select("id,edition,category,title,summary,raw_context,source_url,relevant,published_at,first_seen_at").order("published_at", { ascending: false, nullsFirst: false }).limit(40),
    supabase.from("l2_ru_telegram_digests").select("item_ids").eq("status", "published").order("digest_date", { ascending: false }).limit(24),
  ]);

  const run = runResult.data;
  const digest = digestResult.data;
  const publishedItemIds = [...new Set((publishedResult.data || []).flatMap((row) => Array.isArray(row.item_ids) ? row.item_ids.map(String) : []))];
  const items = (feedResult.data || []).map((item) => ({
    id: String(item.id),
    edition: String(item.edition),
    category: String(item.category),
    title: String(item.title),
    summary: item.summary ? String(item.summary) : null,
    rawContext: item.raw_context ? String(item.raw_context) : "",
    sourceUrl: String(item.source_url),
    relevant: Boolean(item.relevant),
    publishedAt: item.published_at ? String(item.published_at) : null,
    firstSeenAt: String(item.first_seen_at),
    alreadyPublished: publishedItemIds.includes(String(item.id)),
  }));

  return <main className="admin-shell">
    <AdminTopbar/>
    <div className="admin-wrap">
      <div className="admin-head">
        <div><h1>Telegram Composer</h1><p>Радар находит материалы, а финальный состав и глубину поста выбираешь ты.</p></div>
      </div>
      <TelegramMonitorClient
        digestBody={digest?.body ? String(digest.body) : ""}
        digestGeneratedAt={digest?.generated_at ? String(digest.generated_at) : null}
        digestStatus={digest?.status ? String(digest.status) : "draft"}
        digestUpdatedAt={digest?.updated_at ? String(digest.updated_at) : null}
        initialItemIds={Array.isArray(digest?.item_ids) ? digest.item_ids.map(String) : []}
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
