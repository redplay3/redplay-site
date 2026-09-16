"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RepairRow = {
  section_id: string;
  structure_status: string;
  numeric_status: string;
};

type FailedUnitGroup = {
  section_id: string;
  unit_indexes: number[];
};

type RepairPayload = {
  error?: string;
  structureFailures?: number;
  numericFailures?: number;
  ready?: boolean;
  repaired?: RepairRow[];
  failedUnits?: FailedUnitGroup[];
};

async function readJson<T extends { error?: string }>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let payload: T | null = null;
  if (text) {
    try { payload = JSON.parse(text) as T; } catch { /* Vercel may return plain text on timeout */ }
  }
  if (!response.ok) {
    const clean = text.replace(/\s+/g, " ").trim().slice(0, 220);
    throw new Error(payload?.error || clean || `${fallback} (HTTP ${response.status})`);
  }
  if (!payload) throw new Error(`${fallback}: сервер вернул не-JSON ответ`);
  return payload;
}

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

  async function runRepair() {
    const response = await fetch("/api/kr-ingest/repair-snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ snapshotId }),
    });
    return readJson<RepairPayload>(response, "Не удалось перепроверить статью");
  }

  async function rebuildUnit(sectionId: string, unitIndex: number) {
    const response = await fetch("/api/kr-ingest/repair-unit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ snapshotId, sectionId, unitIndex }),
    });
    return readJson<{ error?: string }>(response, `Не удалось починить ${sectionId} / unit ${unitIndex + 1}`);
  }

  async function repair() {
    if (loading) return;
    setLoading(true);
    setMessage("Нормализую таблицы и перепроверяю QA без AI…");
    try {
      let qa = await runRepair();
      const errors: string[] = [];

      // Repair only individual failed semantic units. A large class section therefore
      // no longer waits for one multi-minute Vercel request containing 7–12 AI calls.
      for (let cycle = 1; cycle <= 2 && !qa.ready; cycle += 1) {
        const jobs = (qa.failedUnits || []).flatMap((group) =>
          group.unit_indexes.map((unitIndex) => ({ sectionId: group.section_id, unitIndex })),
        );
        if (!jobs.length) break;

        for (let index = 0; index < jobs.length; index += 1) {
          const job = jobs[index];
          setMessage(`AI-починка ${cycle}/2 · ${index + 1}/${jobs.length}: ${job.sectionId}, блок ${job.unitIndex + 1}`);
          try {
            await rebuildUnit(job.sectionId, job.unitIndex);
          } catch (error) {
            errors.push(error instanceof Error ? error.message : `${job.sectionId}: ошибка`);
          }
        }

        setMessage(`AI-починка ${cycle}/2 завершена. Повторно сверяю структуру и цифры…`);
        qa = await runRepair();
      }

      const tail = errors.length ? ` Ошибок отдельных блоков: ${errors.length}. ${errors.slice(0, 2).join(" · ")}` : "";
      setMessage(qa.ready
        ? `QA пройден: таблицы, структура и числовые факты совпадают.${tail}`
        : `Автопочинка завершена. Осталось: структура FAIL ${qa.structureFailures ?? 0}, цифры FAIL ${qa.numericFailures ?? 0}.${tail}`);
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
        {usefulImages === 0 ? <p style={{ margin: "10px 0 0", color: "#747985", fontSize: 13, lineHeight: 1.5 }}>В исходном материале нет полезного арта: PLAYNC footer-баннер не считаем контентным изображением. Для публикации используем отдельную обложку RedPlay.</p> : null}
      </div>
      {translated && (numericFailures > 0 || structureFailures > 0) ? <button type="button" className="admin-primary" disabled={loading} onClick={repair}>{loading ? "Автопочинка идёт…" : "Автопочинка QA"}</button> : null}
    </div>
    {message ? <div style={{ marginTop: 12, padding: 11, borderRadius: 10, background: "#fff", color: "#555c68", fontSize: 13 }}>{message}</div> : null}
  </section>;
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span style={{ borderRadius: 999, padding: "6px 9px", background: ok ? "#e8f7ed" : "#fff0f2", color: ok ? "#17813b" : "#b21d31", fontSize: 12, fontWeight: 850 }}>{ok ? "✓ " : "! "}{children}</span>;
}
