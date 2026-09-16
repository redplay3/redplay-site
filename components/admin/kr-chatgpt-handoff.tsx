"use client";

import { useState } from "react";

type HandoffResponse = {
  ok: boolean;
  share_url: string;
  expires_at: string;
  summary: {
    semantic_sections: number;
    adapted_sections: number;
    pending_sections: number;
    numeric_failures: number;
    structure_failures: number;
    tables: number;
    images: number;
  };
};

export function KrChatGptHandoff({ snapshotId }: { snapshotId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HandoffResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createHandoff() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const response = await fetch("/api/kr-ingest/chatgpt-handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Не удалось подготовить пакет для ChatGPT");
      setResult(payload as HandoffResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось подготовить пакет для ChatGPT");
    } finally {
      setLoading(false);
    }
  }

  async function copyForChat() {
    if (!result) return;
    const prompt = [
      "Собери Telegram-предложку RedPlay по этому KR-материалу.",
      "Коротко: 4–7 самых важных изменений, без технической воды.",
      "Скажи, стоит ли это публиковать, и выбери до 3 действительно полезных изображений/таблиц из пакета.",
      "Ничего не публикуй без моего подтверждения.",
      result.share_url,
    ].join("\n");
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
  }

  return <section style={{ marginTop: 16, border: "1px solid #d9dcff", borderRadius: 14, background: "#fbfbff", padding: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
      <div style={{ maxWidth: 760 }}>
        <small style={{ display: "block", color: "#6656c9", fontWeight: 950, marginBottom: 5 }}>CHATGPT · РЕДАКТОРСКИЙ МОСТ</small>
        <strong style={{ fontSize: 17 }}>Подготовить материал для этого чата</strong>
        <p style={{ margin: "7px 0 0", color: "#717684", fontSize: 13, lineHeight: 1.6 }}>
          Создаётся временный пакет на 24 часа: RU-адаптация, оригинал KR, таблицы, изображения, PLAYNC-источник и статусы проверок. Ссылка ничего не публикует – она только даёт ChatGPT материал для редакторской предложки.
        </p>
      </div>
      <button type="button" className="admin-primary" disabled={loading} onClick={createHandoff}>
        {loading ? "Готовлю пакет…" : result ? "Создать новую ссылку" : "Подготовить для ChatGPT"}
      </button>
    </div>

    {error ? <div style={{ marginTop: 12, border: "1px solid #efb4bc", borderRadius: 10, background: "#fff0f2", padding: 11, color: "#a0162a", fontSize: 13 }}>{error}</div> : null}

    {result ? <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        <Badge>{result.summary.adapted_sections}/{result.summary.semantic_sections} RU-разделов</Badge>
        <Badge>{result.summary.tables} таблиц</Badge>
        <Badge>{result.summary.images} изображений</Badge>
        <Badge alert={result.summary.numeric_failures > 0}>цифры FAIL: {result.summary.numeric_failures}</Badge>
        <Badge alert={result.summary.structure_failures > 0}>структура FAIL: {result.summary.structure_failures}</Badge>
      </div>

      <div style={{ border: "1px solid #e0e2ea", borderRadius: 10, background: "#fff", padding: 11, fontSize: 12, color: "#606672", overflowWrap: "anywhere" }}>
        {result.share_url}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="admin-primary" onClick={copyForChat}>{copied ? "Скопировано ✓" : "Скопировать для этого чата"}</button>
        <a href={result.share_url} target="_blank" rel="noreferrer" style={{ color: "#6656c9", fontSize: 13, fontWeight: 850 }}>Открыть пакет</a>
        <small style={{ color: "#8a8f99" }}>до {new Date(result.expires_at).toLocaleString("ru-RU")}</small>
      </div>
    </div> : null}
  </section>;
}

function Badge({ children, alert = false }: { children: React.ReactNode; alert?: boolean }) {
  return <span style={{ border: `1px solid ${alert ? "#f0b8bf" : "#dedff0"}`, borderRadius: 999, background: alert ? "#fff2f3" : "#f6f5ff", color: alert ? "#a1162a" : "#6259a1", padding: "5px 8px", fontSize: 11, fontWeight: 850 }}>{children}</span>;
}
