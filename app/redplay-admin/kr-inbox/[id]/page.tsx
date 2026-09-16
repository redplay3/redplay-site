import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KrChatGptHandoff } from "@/components/admin/kr-chatgpt-handoff";
import { KrPrepareItem } from "@/components/admin/kr-prepare-item";
import { KrReviewTabs, type KrReviewBlock, type KrStoredAdaptation } from "@/components/admin/kr-review-tabs";
import { KrTelegramProposal, type KrTelegramDraft } from "@/components/admin/kr-telegram-proposal";
import { assembleSemanticSections } from "@/lib/kr/semantic";
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

  let adaptations: KrStoredAdaptation[] = [];
  let telegramDraft: KrTelegramDraft | null = null;
  if (latest) {
    const { data: adaptationData } = await supabase
      .from("kr_ingest_adaptations")
      .select("id,snapshot_id,section_id,section_index,section_kind,title_kr,title_ru,content,terms,source_ordinals,source_numeric,output_numeric,numeric_status,terminology_status,status,model,input_tokens,output_tokens,updated_at")
      .eq("snapshot_id", latest.id)
      .order("section_index", { ascending: true });
    adaptations = (adaptationData || []) as KrStoredAdaptation[];

    const { data: draftData } = await supabase
      .from("kr_telegram_drafts")
      .select("id,item_id,snapshot_id,status,priority,recommend_publish,recommendation_reason,title,body,source_url,model,input_tokens,output_tokens,char_count,updated_at")
      .eq("snapshot_id", latest.id)
      .maybeSingle();
    telegramDraft = (draftData || null) as KrTelegramDraft | null;
  }

  const sectionCount = blocks.length ? assembleSemanticSections(blocks).length : 0;
  const articleReady = sectionCount > 0
    && adaptations.length >= sectionCount
    && adaptations.every((row) => row.numeric_status !== "fail" && row.content?.validation?.structure_status !== "fail");

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
        <Fact label="Версия snapshot" value={latest ? `v${latest.version}` : "v0"} />
        <Fact label="Структурных блоков" value={String(blocks.length)} />
        <Fact label="Чисел для контроля" value={String(numericCount(blocks))} />
        <Fact label="Parser" value={latest?.parser_version || "ожидает запуска"} />
        <Fact label="Snapshot hash" value={latest ? latest.content_hash.slice(0, 14) + "…" : "ещё не создан"} />
      </section>

      {snapshots.length > 1 ? <section style={{ marginTop: 16, border: "1px solid #dfe2e8", borderRadius: 14, background: "#fff", padding: 16 }}>
        <strong>История оригинала</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {snapshots.map((snapshot) => <span key={snapshot.id} className="admin-status">v{snapshot.version} · {new Date(snapshot.fetched_at).toLocaleString("ru-RU")}</span>)}
        </div>
      </section> : null}

      {latest && blocks.length ? <section style={{ marginTop: 16, border: "1px solid #dfe2e8", borderRadius: 14, background: "#fff", padding: 16 }}>
        <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <strong>Оригинал PLAYNC</strong>
          <small style={{ color: "#747985", lineHeight: 1.5 }}>Можно безопасно перепроверить источник. Новый snapshot появится только если содержимое реально изменилось.</small>
        </div>
        <KrPrepareItem url={item.primary_url} mode="refresh" />
      </section> : null}

      {latest ? <KrTelegramProposal itemId={item.id} initialDraft={telegramDraft} articleReady={articleReady} /> : null}
      {latest && blocks.length ? <KrChatGptHandoff snapshotId={latest.id} /> : null}

      {blocks.length && latest
        ? <KrReviewTabs blocks={blocks} snapshotId={latest.id} initialAdaptations={adaptations} />
        : <section style={{ marginTop: 22, border: "1px solid #dfe2e8", borderRadius: 16, background: "#fff", padding: 20 }}>
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            <small style={{ color: "#1c8a50", fontWeight: 900 }}>{latest ? "НУЖЕН ПОВТОРНЫЙ РАЗБОР" : "НАЙДЕНО KR RADAR"}</small>
            <h2 style={{ margin: 0, fontSize: 22 }}>{latest ? "Подготовить структурные блоки" : "Загрузить официальный материал"}</h2>
            <p style={{ margin: 0, color: "#747985", lineHeight: 1.6 }}>
              {latest
                ? "Snapshot уже существует, но блоки не распознаны. Можно безопасно запустить подготовку ещё раз."
                : "Радар уже поставил публикацию в очередь. Пока это только ссылка и метаданные – оригинал ещё не загружался, Cloudflare AI не запускался."}
            </p>
          </div>
          <KrPrepareItem url={item.primary_url} mode={latest ? "refresh" : "prepare"} />
        </section>}
    </div>
  </main>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div style={{ border: "1px solid #dfe2e8", borderRadius: 12, background: "#fff", padding: 14 }}><small style={{ display: "block", color: "#8b909a", marginBottom: 5 }}>{label}</small><strong style={{ overflowWrap: "anywhere" }}>{value}</strong></div>;
}
