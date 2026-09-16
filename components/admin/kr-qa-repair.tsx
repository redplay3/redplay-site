"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function KrQaRepair({
  snapshotId,
  sectionCount,
  adaptationCount,
  numericFailures,
  structureFailures,
  usefulImages,
}: {
  snapshotId: string;
  sectionCount: number;
  adaptationCount: number;
  numericFailures: number;
  structureFailures: number;
  usefulImages: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const translated = adaptationCount >= sectionCount && sectionCount > 0;
  const ready = translated && numericFailures === 0 && structureFailures === 0;

  async function repair() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/kr-ingest/repair-snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      const payload = await response.json() as {
        error?: string;
        structureFailures?: number;
        numericFailures?: number;
        ready?: boolean;
      };
      if (!response.ok) throw new Error(payload.error || "Не удалось перепроверить статью");
      setMessage(payload.ready
        ? "QA пройден: структура и числовые факты совпадают."
        : `Перепроверено. Осталось: структура FAIL ${payload.structureFailures ?? 0}, цифры FAIL ${payload.numericFailures ?? 0}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось перепроверить статью");
    } finally {
      setLoading(false);
    }
  }

  return <section style={{ marginTop: 18, border: `1px solid ${ready ? "#bde5ca" : "#ead39b"}`, borderRadius: 16, background: ready ? "#f5fff8" : "#fffaf0", padding: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div>
        <small style={{ color: ready ? "#16834a" : "#9a6d11", fontWeight: 950 }}>ГОТОВНОСТЬ К ПУБЛИКАЦИИ</small>
        <h2 style={{ margin: "6px 0 8px", fontSize: 21 }}>{ready ? "QA пройден" : translated ? "Перевод готов, QA ещё требует внимания" : "Перевод ещё не завершён"}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge ok={translated}>Перевод {Math.min(adaptationCount, sectionCount)}/{sectionCount}</Badge>
          <Badge ok={numericFailures === 0}>Цифры FAIL: {numericFailures}</Badge>
          <Badge ok={structureFailures === 0}>Структура FAIL: {structureFailures}</Badge>
          <Badge ok={usefulImages > 0}>Полезных изображений: {usefulImages}</Badge>
          <Badge ok={false}>Обложка RedPlay: нужна</Badge>
        </div>
        {usefulImages === 0 ? <p style={{ margin: "10px 0 0", color: "#747985", fontSize: 13, lineHeight: 1.5 }}>В исходном материале нет полезного арта: найденный PLAYNC footer-баннер не считаем контентным изображением. Для публикации нужна отдельная обложка RedPlay.</p> : null}
      </div>
      {translated && (numericFailures > 0 || structureFailures > 0) ? <button type="button" className="admin-primary" disabled={loading} onClick={repair}>{loading ? "Перепроверяю…" : "Починить структуру и перепроверить QA"}</button> : null}
    </div>
    {message ? <div style={{ marginTop: 12, padding: 11, borderRadius: 10, background: "#fff", color: "#555c68", fontSize: 13 }}>{message}</div> : null}
  </section>;
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span style={{ borderRadius: 999, padding: "6px 9px", background: ok ? "#e8f7ed" : "#fff0f2", color: ok ? "#17813b" : "#b21d31", fontSize: 12, fontWeight: 850 }}>{ok ? "✓ " : "! "}{children}</span>;
}
