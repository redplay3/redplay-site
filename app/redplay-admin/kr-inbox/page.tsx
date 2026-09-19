import Link from "next/link";
import { redirect } from "next/navigation";
import { KrIngestProbe } from "@/components/admin/kr-ingest-probe";
import { createClient } from "@/lib/supabase/server";
import { AdminTopbar } from "@/components/admin/admin-topbar";

type InboxRow = {
  id: string;
  title_kr: string | null;
  edition: "essence" | "main" | null;
  source_kind: string;
  status: string;
  article_id: string | null;
  feed_id: string | null;
  latest_snapshot_version: number;
  updated_at: string;
};

type RadarRun = {
  checked_at: string;
  ok: boolean;
  discovered_count: number;
  new_count: number;
  queued_count: number;
};

export default async function KrInboxPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/redplay-admin");

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/redplay-admin/login");

  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) redirect("/redplay-admin/login?error=access");

  const [{ data: inboxData, error: inboxError }, { data: radarData }] = await Promise.all([
    supabase
      .from("kr_ingest_items")
      .select("id,title_kr,edition,source_kind,status,article_id,feed_id,latest_snapshot_version,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("kr_radar_runs")
      .select("checked_at,ok,discovered_count,new_count,queued_count")
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const inbox = (inboxData || []) as InboxRow[];
  const radar = radarData as RadarRun | null;
  const storageReady = !inboxError;

  return <main className="admin-shell">
    <AdminTopbar />
    <div className="admin-wrap">
      <div className="admin-head">
        <div>
          <h1>KR Inbox</h1>
          <p>PLAYNC / Purple Lounge → snapshot → структурные блоки → проверка KR Original ↔ RedPlay.</p>
        </div>
      </div>

      {!storageReady ? <div style={{ marginTop: 18, padding: 14, border: "1px solid #ead39b", borderRadius: 12, background: "#fff8df", color: "#765b10", fontSize: 13 }}>
        Snapshot Storage ещё не создан в Supabase. Probe продолжит работать, но для импорта нужна миграция <strong>docs/kr-ingest.sql</strong>.
      </div> : null}

      <section style={{ marginTop: 20, border: `1px solid ${radar?.ok ? "#bfe7cf" : "#e6d39d"}`, borderRadius: 16, background: radar?.ok ? "#f5fff8" : "#fffaf0", padding: 18 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <small style={{ display: "block", color: radar?.ok ? "#16834a" : "#9a6d11", fontWeight: 950, marginBottom: 5 }}>
              KR RADAR · {radar?.ok ? "ACTIVE" : radar ? "CHECK" : "ОЖИДАЕТ ПЕРВОГО ЗАПУСКА"}
            </small>
            <strong style={{ fontSize: 18 }}>6 официальных досок PLAYNC · каждые 8 часов</strong>
            <p style={{ margin: "6px 0 0", color: "#747985", fontSize: 13 }}>
              {radar
                ? `Последняя проверка: ${new Date(radar.checked_at).toLocaleString("ru-RU", { timeZone: "Europe/Kyiv" })} · проверено ${radar.discovered_count} · поставлено в очередь ${radar.queued_count}`
                : "Новые articleId будут появляться здесь автоматически. Самопубликация отключена."}
            </p>
          </div>
          <span className="admin-status">AUTO DISCOVERY</span>
        </div>
      </section>

      <div style={{ marginTop: 20 }}><KrIngestProbe /></div>

      {storageReady ? <section style={{ marginTop: 28 }}>
        <div className="admin-head"><div><h2 style={{ fontSize: 24, fontWeight: 950 }}>Сохранённые материалы</h2><p>v0 – найдено радаром; v1+ – оригинал уже загружен и разобран.</p></div></div>
        {inbox.length ? <div className="admin-grid">{inbox.map((item) => <Link className="admin-article-row" key={item.id} href={`/redplay-admin/kr-inbox/${item.id}`}>
          <span><strong>{item.title_kr || "KR publication"}</strong><small>{(item.edition || "unknown").toUpperCase()} · {item.source_kind} · {item.article_id ? `articleId ${item.article_id}` : item.feed_id ? `feedId ${item.feed_id}` : "без ID"}</small></span>
          <span style={{ color: "#747985", fontSize: 12, fontWeight: 850 }}>v{item.latest_snapshot_version}</span>
          <span className={`admin-status ${item.status}`}>{item.status}</span>
        </Link>)}</div> : <div className="admin-empty"><p>KR Inbox пока пуст. Радар автоматически добавит новые официальные публикации.</p></div>}
      </section> : null}
    </div>
  </main>;
}
