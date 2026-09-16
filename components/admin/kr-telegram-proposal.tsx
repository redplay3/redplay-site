"use client";

import { useState } from "react";

export type KrTelegramDraft = {
  id: string;
  item_id: string;
  snapshot_id: string;
  status: "draft" | "approved" | "skipped" | "published";
  priority: "high" | "medium" | "low";
  recommend_publish: boolean;
  recommendation_reason: string | null;
  title: string;
  body: string;
  source_url: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  char_count: number;
  updated_at: string;
};

const priorityMeta = {
  high: { label: "Высокий", icon: "🔥", fg: "#a0162a", bg: "#fff0f2", border: "#efb4bc" },
  medium: { label: "Средний", icon: "🟡", fg: "#826000", bg: "#fff8df", border: "#ead691" },
  low: { label: "Низкий", icon: "⚪", fg: "#656b75", bg: "#f4f5f7", border: "#d9dde3" },
} as const;

export function KrTelegramProposal({ itemId, initialDraft, articleReady }: { itemId: string; initialDraft: KrTelegramDraft | null; articleReady: boolean }) {
  const [draft, setDraft] = useState<KrTelegramDraft | null>(initialDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(force = false) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/kr-ingest/telegram-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, force }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось собрать Telegram-предложку");
      setDraft(payload.draft as KrTelegramDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось собрать Telegram-предложку");
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(status: "approved" | "skipped" | "draft") {
    if (!draft || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/kr-ingest/telegram-draft", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftId: draft.id, status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось изменить статус");
      setDraft(payload.draft as KrTelegramDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить статус");
    } finally {
      setLoading(false);
    }
  }

  const meta = draft ? priorityMeta[draft.priority] : null;

  return <section style={{ marginTop: 22, border: "1px solid #dfe2e8", borderRadius: 16, background: "#fff", overflow: "hidden" }}>
    <div style={{ padding: 18, borderBottom: "1px solid #edf0f3", display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
      <div>
        <small style={{ color: "#22975b", fontWeight: 950, letterSpacing: ".06em" }}>TELEGRAM · ПРЕДЛОЖКА</small>
        <h2 style={{ margin: "6px 0 0", fontSize: 21 }}>Короткий пост для канала</h2>
        <p style={{ margin: "7px 0 0", color: "#747985", fontSize: 13, lineHeight: 1.55, maxWidth: 780 }}>
          Composer выбирает только главное и сам оценивает полезность материала для канала. Ничего в Telegram не публикуется без твоего решения.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="admin-primary" disabled={loading || !articleReady} onClick={() => generate(Boolean(draft))}>
          {loading ? "Собираю…" : draft ? "Пересобрать предложку" : "Собрать предложку"}
        </button>
      </div>
    </div>

    {!articleReady ? <div style={{ padding: 18, color: "#826000", background: "#fffaf0" }}>
      Сначала собери RU-адаптацию статьи. Telegram Composer работает только по уже проверенному русскому материалу.
    </div> : null}

    {error ? <div style={{ margin: 18, border: "1px solid #efb4bc", borderRadius: 12, background: "#fff0f2", padding: 13, color: "#a0162a", fontSize: 13 }}>{error}</div> : null}

    {draft ? <div style={{ padding: 18, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {meta ? <span style={{ border: `1px solid ${meta.border}`, background: meta.bg, color: meta.fg, borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 900 }}>{meta.icon} {meta.label} приоритет</span> : null}
        <span style={{ border: `1px solid ${draft.recommend_publish ? "#9ed8b7" : "#d9dde3"}`, background: draft.recommend_publish ? "#effaf3" : "#f4f5f7", color: draft.recommend_publish ? "#15753b" : "#656b75", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 900 }}>
          {draft.recommend_publish ? "Рекомендует к публикации" : "Не рекомендует публиковать"}
        </span>
        <span style={{ color: "#868c96", fontSize: 12 }}>{draft.char_count} символов</span>
        <span style={{ color: "#868c96", fontSize: 12 }}>Статус: {statusLabel(draft.status)}</span>
      </div>

      {draft.recommendation_reason ? <div style={{ borderLeft: "3px solid #d7dbe2", paddingLeft: 12, color: "#686f7a", fontSize: 13, lineHeight: 1.55 }}>
        <strong>Почему:</strong> {draft.recommendation_reason}
      </div> : null}

      <div style={{ border: "1px solid #e2e5ea", borderRadius: 14, background: "#fafbfc", padding: 16 }}>
        <div style={{ fontWeight: 950, fontSize: 17, marginBottom: 10 }}>{draft.title}</div>
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.62, fontSize: 14 }}>{draft.body}</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="admin-primary" disabled={loading || draft.status === "approved"} onClick={() => setStatus("approved")}>✅ Одобрить для Telegram</button>
        <button type="button" disabled={loading || draft.status === "skipped"} onClick={() => setStatus("skipped")} style={secondaryButtonStyle}>❌ Пропустить</button>
        {draft.status !== "draft" ? <button type="button" disabled={loading} onClick={() => setStatus("draft")} style={secondaryButtonStyle}>↩ Вернуть в предложку</button> : null}
      </div>

      <small style={{ color: "#9297a0" }}>Публикация в канал пока намеренно отключена. Сначала проверяем качество предложек.</small>
    </div> : articleReady ? <div style={{ padding: 18, color: "#747985", fontSize: 13 }}>
      Предложка ещё не собрана. Нажми «Собрать предложку» – Composer подготовит один короткий пост и рекомендацию.
    </div> : null}
  </section>;
}

function statusLabel(status: KrTelegramDraft["status"]) {
  if (status === "approved") return "одобрено";
  if (status === "skipped") return "пропущено";
  if (status === "published") return "опубликовано";
  return "на рассмотрении";
}

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #d7dbe2",
  borderRadius: 10,
  background: "#fff",
  color: "#626874",
  padding: "9px 13px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};
