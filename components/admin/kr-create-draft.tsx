"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function responsePayload(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch { return { error: text.slice(0, 500) }; }
}

export function KrCreateDraft({ snapshotId, ready }: { snapshotId: string; ready: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createDraft() {
    if (!ready || loading) return;
    setLoading(true);
    setMessage("Собираю черновик RedPlay из проверенной RU-адаптации…");
    try {
      const response = await fetch("/api/kr-ingest/create-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      const payload = await responsePayload(response);
      if (!response.ok) throw new Error(String(payload.error || "Не удалось создать черновик"));
      const articleId = String(payload.articleId || "");
      if (!articleId) throw new Error("Сервер не вернул ID черновика");
      setMessage(payload.existing ? "Черновик уже существует. Открываю редактор…" : "Черновик создан. Открываю редактор…");
      router.push(`/redplay-admin/articles/${articleId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось создать черновик");
      setLoading(false);
    }
  }

  return <section style={{ marginTop: 18, border: `1px solid ${ready ? "#bde5ca" : "#e3d9bd"}`, borderRadius: 16, background: ready ? "#f5fff8" : "#fbfaf7", padding: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <small style={{ color: ready ? "#16834a" : "#8a7b55", fontWeight: 950 }}>ПУБЛИКАЦИЯ НА REDPLAY</small>
        <h2 style={{ margin: "5px 0 6px", fontSize: 21 }}>{ready ? "Материал можно переносить в редактор" : "Сначала нужен зелёный QA"}</h2>
        <p style={{ margin: 0, color: "#737985", fontSize: 13, lineHeight: 1.55 }}>Создаст обычный черновик сайта: текст, таблицы и разделы уже будут заполнены. После перехода останется загрузить обложку, быстро просмотреть материал и нажать «Опубликовать».</p>
      </div>
      <button type="button" className="admin-primary" disabled={!ready || loading} onClick={createDraft}>{loading ? "Создаю черновик…" : "Создать черновик RedPlay"}</button>
    </div>
    {message ? <div style={{ marginTop: 12, background: "#fff", borderRadius: 10, padding: 10, color: "#59606d", fontSize: 13 }}>{message}</div> : null}
  </section>;
}
