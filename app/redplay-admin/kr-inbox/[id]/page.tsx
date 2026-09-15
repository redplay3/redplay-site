import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminTopbar } from "../../layout";

type InboxItem = {
  id: string;
  edition: "essence" | "main" | null;
  source_kind: string;
  primary_url: string;
  plaync_url: string | null;
  article_id: string | null;
  feed_id: string | null;
  title_kr: string | null;
  status: string;
  latest_snapshot_version: number;
};

type Snapshot = {
  id: string;
  version: number;
  source_url: string;
  content_hash: string;
  fetched_at: string;
  metrics: Record<string, unknown> | null;
  parser_version: string;
};

type Block = {
  id: string;
  ordinal: number;
  block_type: string;
  source_type: string | null;
  text_kr: string | null;
  raw_html: string | null;
  data: Record<string, unknown> | null;
};

export default async function KrInboxItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) redirect("/redplay-admin");

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/redplay-admin/login");
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) redirect("/redplay-admin/login?error=access");

  const { data: itemData, error: itemError } = await supabase
    .from("kr_ingest_items")
    .select("id,edition,source_kind,primary_url,plaync_url,article_id,feed_id,title_kr,status,latest_snapshot_version")
    .eq("id", id)
    .maybeSingle();

  if (itemError || !itemData) notFound();
  const item = itemData as InboxItem;

  const { data: snapshotData } = await supabase
    .from("kr_ingest_snapshots")
    .select("id,version,source_url,content_hash,fetched_at,metrics,parser_version")
    .eq("item_id", id)
    .order("version", { ascending: false });
  const snapshots = (snapshotData || []) as Snapshot[];
  const latest = snapshots[0];

  const { data: blockData } = latest
    ? await supabase
      .from("kr_ingest_blocks")
      .select("id,ordinal,block_type,source_type,text_kr,raw_html,data")
      .eq("snapshot_id", latest.id)
      .order("ordinal", { ascending: true })
    : { data: [] };
  const blocks = (blockData || []) as Block[];

  return <main className="admin-shell">
    <AdminTopbar />
    <div className="admin-wrap">
      <div style={{ marginBottom: 14 }}><Link href="/redplay-admin/kr-inbox" style={{ color: "#707682", fontSize: 13 }}>← KR Inbox</Link></div>
      <div className="admin-head" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 style={{ maxWidth: 1000 }}>{item.title_kr || "KR publication"}</h1>
          <p>{(item.edition || "unknown").toUpperCase()} · {item.source_kind} · {item.article_id ? `articleId ${item.article_id}` : item.feed_id ? `feedId ${item.feed_id}` : "без внешнего ID"}</p>
        </div>
        <span className={`admin-status ${item.status}`}>{item.status}</span>
      </div>

      <section style={{ marginTop: 24, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <Fact label="Версия snapshot" value={latest ? `v${latest.version}` : "—"} />
        <Fact label="Блоков" value={String(blocks.length)} />
        <Fact label="Parser" value={latest?.parser_version || "—"} />
        <Fact label="Snapshot hash" value={latest ? latest.content_hash.slice(0, 14) + "…" : "—"} />
      </section>

      {snapshots.length > 1 ? <section style={{ marginTop: 16, border: "1px solid #dfe2e8", borderRadius: 14, background: "#fff", padding: 16 }}>
        <strong>История оригинала</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {snapshots.map((snapshot) => <span key={snapshot.id} className="admin-status">v{snapshot.version} · {new Date(snapshot.fetched_at).toLocaleString("ru-RU")}</span>)}
        </div>
      </section> : null}

      <section style={{ marginTop: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, marginBottom: 10, position: "sticky", top: 68, zIndex: 10, background: "#eef0f4", padding: "10px 0" }}>
          <div style={{ fontWeight: 950 }}>🇰🇷 KR ORIGINAL</div>
          <div style={{ fontWeight: 950 }}>🇷🇺 REDPLAY</div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {blocks.map((block) => <div key={block.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
            <article style={{ minWidth: 0, border: "1px solid #dfe2e8", borderRadius: 14, background: "#fff", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8, color: "#858b96", fontSize: 11, fontWeight: 850, textTransform: "uppercase" }}>
                <span>#{block.ordinal + 1} · {block.block_type}</span>
                <span>{block.source_type || "html"}</span>
              </div>
              {block.text_kr ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, fontSize: 14 }}>{block.text_kr}</div> : <div style={{ color: "#a0a5ae", fontSize: 13 }}>Текст отсутствует</div>}
              {block.block_type === "table" || block.block_type === "image" ? <details style={{ marginTop: 10 }}><summary style={{ cursor: "pointer", color: "#747985", fontSize: 12 }}>Структурные данные</summary><pre style={{ marginTop: 8, overflow: "auto", borderRadius: 10, background: "#f3f4f6", padding: 10, fontSize: 11 }}>{JSON.stringify(block.data || {}, null, 2)}</pre></details> : null}
            </article>

            <article style={{ minWidth: 0, border: "1px dashed #cdd1d8", borderRadius: 14, background: "#f8f9fb", padding: 14 }}>
              <div style={{ color: "#8a909a", fontSize: 11, fontWeight: 850, textTransform: "uppercase", marginBottom: 8 }}>Ожидает адаптации</div>
              <div style={{ color: "#747985", fontSize: 13, lineHeight: 1.6 }}>Здесь появится русский блок RedPlay. На следующем этапе добавим перевод, терминологический статус и числовую валидацию.</div>
            </article>
          </div>)}
        </div>
      </section>

      {!blocks.length ? <div className="admin-empty"><p>У последнего snapshot пока нет распознанных блоков.</p></div> : null}
    </div>
  </main>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div style={{ border: "1px solid #dfe2e8", borderRadius: 12, background: "#fff", padding: 14 }}><small style={{ display: "block", color: "#8b909a", marginBottom: 5 }}>{label}</small><strong style={{ overflowWrap: "anywhere" }}>{value}</strong></div>;
}
