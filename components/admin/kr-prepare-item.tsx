"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function KrPrepareItem({ url, mode = "prepare" }: { url: string; mode?: "prepare" | "refresh" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function prepare() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/kr-ingest/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось подготовить материал");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подготовить материал");
    } finally {
      setLoading(false);
    }
  }

  const refresh = mode === "refresh";

  return <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
    <button
      type="button"
      onClick={prepare}
      disabled={loading}
      style={{
        border: 0,
        borderRadius: 12,
        padding: "12px 18px",
        background: "#ff3347",
        color: "#fff",
        fontWeight: 900,
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "Загружаю оригинал…" : refresh ? "Обновить оригинал" : "Подготовить материал"}
    </button>
    <small style={{ color: "#747985", lineHeight: 1.5 }}>
      {refresh
        ? "Повторно проверит официальный PLAYNC. Если оригинал изменился или источник теперь разбирается полнее, создаст новый snapshot. Публикации на сайт не будет."
        : "Загрузит официальный PLAYNC, создаст snapshot, разберёт таблицы и подготовит смысловые разделы. Публикации на сайт не будет."}
    </small>
    {error ? <div style={{ color: "#c62435", fontSize: 13, fontWeight: 750 }}>{error}</div> : null}
  </div>;
}
