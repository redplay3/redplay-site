"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type ProbeResult = {
  ok: boolean;
  requestedUrl: string;
  finalUrl: string;
  source: {
    definition: {
      label: string;
      edition: "essence" | "main" | null;
      kind: string;
      priority: string;
    };
    articleId: string | null;
  };
  feedId: string | null;
  resolvedEdition: "essence" | "main" | null;
  resolvedArticleId: string | null;
  linkedPlaync: {
    url: string;
    label: string;
    edition: "essence" | "main" | null;
    articleId: string | null;
  } | null;
  httpStatus: number;
  contentType: string | null;
  fetchedAt: string;
  title: string | null;
  contentHash: string | null;
  metrics: {
    bodyChars: number;
    tableCount: number;
    imageCount: number;
    headingCount: number;
    contentBlockCount: number;
  };
  error?: string;
};

type ImportResult = {
  ok: boolean;
  duplicate: boolean;
  reparsed?: boolean;
  itemId: string;
  snapshotId: string;
  version: number;
  blockCount: number;
  contentHash: string;
  parserVersion?: string;
  error?: string;
};

export function KrIngestProbe() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setImportResult(null);

    try {
      const response = await fetch("/api/kr-ingest/probe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = await response.json();
      if (!response.ok && !payload.source) throw new Error(payload.error || "Проверка не удалась");
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Проверка не удалась");
    } finally {
      setLoading(false);
    }
  }

  async function importToInbox() {
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const response = await fetch("/api/kr-ingest/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Импорт не удался");
      setImportResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Импорт не удался");
    } finally {
      setImporting(false);
    }
  }

  return <div style={{ display: "grid", gap: 18 }}>
    <form onSubmit={submit} style={{ display: "grid", gap: 10, padding: 18, border: "1px solid #dfe2e8", borderRadius: 16, background: "#fff" }}>
      <label htmlFor="kr-source-url" style={{ fontWeight: 800 }}>Официальная ссылка PLAYNC или Purple Lounge</label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          id="kr-source-url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://lineage2.plaync.com/board/l2update/view?articleId=..."
          style={{ flex: "1 1 520px", minWidth: 0, borderRadius: 10, border: "1px solid #d8dce3", padding: "12px 14px", background: "#f6f7f9", color: "#171922" }}
        />
        <button className="admin-primary" type="submit" disabled={loading}>{loading ? "Проверяю…" : "Проверить источник"}</button>
      </div>
      <small style={{ opacity: .65 }}>Probe ничего не сохраняет. После успешной проверки появится отдельная кнопка импорта snapshot в KR Inbox.</small>
    </form>

    {error ? <div style={{ padding: 16, borderRadius: 12, color: "#a0162a", background: "#fff0f2", border: "1px solid #efb4bc" }}>{error}</div> : null}

    {result ? <section style={{ display: "grid", gap: 14, padding: 18, border: "1px solid #dfe2e8", borderRadius: 16, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ opacity: .6, fontSize: 13 }}>{result.source.definition.label}</div>
          <h2 style={{ margin: "6px 0 0", fontSize: 20 }}>{result.title || "Заголовок не извлечён"}</h2>
        </div>
        <strong style={{ color: result.ok ? "#159447" : "#c81931" }}>{result.ok ? "SOURCE OK" : "SOURCE ERROR"}</strong>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10 }}>
        <Metric label="Версия" value={(result.resolvedEdition || "unknown").toUpperCase()} />
        <Metric label="HTTP" value={String(result.httpStatus)} />
        <Metric label="articleId" value={result.resolvedArticleId || "—"} />
        <Metric label="feedId" value={result.feedId || "—"} />
        <Metric label="Символов" value={result.metrics.bodyChars.toLocaleString("ru-RU")} />
        <Metric label="Таблиц" value={String(result.metrics.tableCount)} />
        <Metric label="Изображений" value={String(result.metrics.imageCount)} />
        <Metric label="Заголовков" value={String(result.metrics.headingCount)} />
        <Metric label="Content blocks" value={String(result.metrics.contentBlockCount)} />
      </div>

      {result.linkedPlaync ? <div style={{ padding: 14, borderRadius: 12, background: "#eef5ff", border: "1px solid #cddff8" }}>
        <strong>Связанный первоисточник PLAYNC найден</strong>
        <div style={{ marginTop: 6, fontSize: 13, opacity: .72 }}>{result.linkedPlaync.label}</div>
        <a href={result.linkedPlaync.url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 5, overflowWrap: "anywhere", color: "#1559a6" }}>{result.linkedPlaync.url}</a>
      </div> : null}

      {result.error ? <div style={{ color: "#c81931" }}>{result.error}</div> : null}
      <div style={{ fontSize: 13, opacity: .62, overflowWrap: "anywhere" }}>SHA-256: {result.contentHash || "—"}</div>

      {result.ok ? <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingTop: 4 }}>
        <button className="admin-primary" type="button" onClick={importToInbox} disabled={importing}>{importing ? "Импортирую…" : "Импортировать в KR Inbox"}</button>
        <small style={{ opacity: .62 }}>Новый hash создаёт следующую версию snapshot. Тот же hash остаётся той же версией.</small>
      </div> : null}
    </section> : null}

    {importResult ? <section style={{ display: "grid", gap: 10, padding: 18, border: "1px solid #bfe4cb", borderRadius: 16, background: "#f1fbf4" }}>
      <strong style={{ color: "#167d3d" }}>
        {importResult.reparsed
          ? `Snapshot v${importResult.version} переразобран новым parser`
          : importResult.duplicate
            ? `Snapshot v${importResult.version} уже сохранён`
            : `Snapshot v${importResult.version} сохранён`}
      </strong>
      <div>{importResult.blockCount.toLocaleString("ru-RU")} структурных блоков подготовлено для проверки{importResult.parserVersion ? ` · ${importResult.parserVersion}` : ""}.</div>
      <Link className="admin-secondary" href={`/redplay-admin/kr-inbox/${importResult.itemId}`}>Открыть KR Original ↔ RedPlay</Link>
    </section> : null}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 12, borderRadius: 12, background: "#f0f1f3" }}><small style={{ display: "block", opacity: .58, marginBottom: 5 }}>{label}</small><strong>{value}</strong></div>;
}
