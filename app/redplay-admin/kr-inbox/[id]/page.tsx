import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KrReviewTabs, type KrReviewBlock } from "@/components/admin/kr-review-tabs";
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

function numericCount(blocks: KrReviewBlock[]) {
  return blocks.reduce((sum, block) => {
    const value = block.data?.numericTokens;
    return sum + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

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
  const blocks = (blockData || []) as KrReviewBlock[];

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
        <Fact label="Структурных блоков" value={String(blocks.length)} />
        <Fact label="Чисел для контроля" value={String(numericCount(blocks))} />
        <Fact label="Parser" value={latest?.parser_version || "—"} />
        <Fact label="Snapshot hash" value={latest ? latest.content_hash.slice(0, 14) + "…" : "—"} />
      </section>

      {snapshots.length > 1 ? <section style={{ marginTop: 16, border: "1px solid #dfe2e8", borderRadius: 14, background: "#fff", padding: 16 }}>
        <strong>История оригинала</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {snapshots.map((snapshot) => <span key={snapshot.id} className="admin-status">v{snapshot.version} · {new Date(snapshot.fetched_at).toLocaleString("ru-RU")}</span>)}
        </div>
      </section> : null}

      {blocks.length ? <KrReviewTabs blocks={blocks} /> : <div className="admin-empty"><p>У последнего snapshot пока нет распознанных блоков.</p></div>}
    </div>
  </main>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div style={{ border: "1px solid #dfe2e8", borderRadius: 12, background: "#fff", padding: 14 }}><small style={{ display: "block", color: "#8b909a", marginBottom: 5 }}>{label}</small><strong style={{ overflowWrap: "anywhere" }}>{value}</strong></div>;
}
