"use client";

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
  };
  error?: string;
};

export function KrIngestProbe() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/kr-ingest/probe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = await response.json();
      if (!response.ok && !payload.source) {
        throw new Error(payload.error || "Проверка не удалась");
      }
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Проверка не удалась");
    } finally {
      setLoading(false);
    }
  }

  return <div style={{ display: "grid", gap: 18 }}>
    <form onSubmit={submit} style={{ display: "grid", gap: 10, padding: 18, border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, background: "rgba(255,255,255,.03)" }}>
      <label htmlFor="kr-source-url" style={{ fontWeight: 700 }}>Официальная ссылка PLAYNC или Purple Lounge</label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          id="kr-source-url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://lineage2.plaync.com/board/l2update/view?articleId=..."
          style={{ flex: "1 1 520px", minWidth: 0, borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", padding: "12px 14px", background: "rgba(0,0,0,.2)", color: "inherit" }}
        />
        <button className="admin-primary" type="submit" disabled={loading}>{loading ? "Проверяю…" : "Проверить источник"}</button>
      </div>
      <small style={{ opacity: .7 }}>На этом этапе ничего не сохраняется и не публикуется. Probe только проверяет доступность и структуру источника.</small>
    </form>

    {error ? <div style={{ padding: 16, borderRadius: 12, background: "rgba(180,40,40,.12)", border: "1px solid rgba(255,90,90,.25)" }}>{error}</div> : null}

    {result ? <section style={{ display: "grid", gap: 14, padding: 18, border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, background: "rgba(255,255,255,.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ opacity: .65, fontSize: 13 }}>{result.source.definition.label}</div>
          <h2 style={{ margin: "6px 0 0" }}>{result.title || "Заголовок не извлечён"}</h2>
        </div>
        <strong style={{ color: result.ok ? "#6ee7a8" : "#ff8585" }}>{result.ok ? "SOURCE OK" : "SOURCE ERROR"}</strong>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
        <Metric label="Версия" value={(result.source.definition.edition || "unknown").toUpperCase()} />
        <Metric label="HTTP" value={String(result.httpStatus)} />
        <Metric label="articleId" value={result.source.articleId || "—"} />
        <Metric label="Символов" value={result.metrics.bodyChars.toLocaleString("ru-RU")} />
        <Metric label="Таблиц" value={String(result.metrics.tableCount)} />
        <Metric label="Изображений" value={String(result.metrics.imageCount)} />
        <Metric label="Заголовков" value={String(result.metrics.headingCount)} />
      </div>

      {result.error ? <div style={{ color: "#ff9a9a" }}>{result.error}</div> : null}
      <div style={{ fontSize: 13, opacity: .65, overflowWrap: "anywhere" }}>SHA-256: {result.contentHash || "—"}</div>
    </section> : null}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 12, borderRadius: 12, background: "rgba(0,0,0,.16)" }}><small style={{ display: "block", opacity: .6, marginBottom: 5 }}>{label}</small><strong>{value}</strong></div>;
}
