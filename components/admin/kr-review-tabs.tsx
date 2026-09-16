"use client";

import { useMemo, useState } from "react";
import { assembleSemanticSections, type KrSemanticSection, type KrSemanticSourceBlock, type KrSemanticUnit } from "@/lib/kr/semantic";

export type KrReviewBlock = KrSemanticSourceBlock;

type NumericToken = { raw: string; normalized: string; kind: "percent" | "number" };
type TableCell = { text: string; colspan?: number; rowspan?: number; header?: boolean };
type Tab = "redplay" | "original" | "qa";

type AdaptedUnit = {
  type: "text" | "table" | "image";
  paragraphs_ru: string[];
  rows_ru: string[][];
  caption_ru: string;
};

type AdaptedTerm = {
  kr: string;
  en: string;
  ru: string;
  display: string;
  status: string;
};

export type KrStoredAdaptation = {
  id: string;
  snapshot_id: string;
  section_id: string;
  section_index: number;
  section_kind: string;
  title_kr: string | null;
  title_ru: string;
  content: {
    units?: AdaptedUnit[];
    validation?: {
      structure_status?: string;
      structure_issues?: string[];
    };
  } | null;
  terms: AdaptedTerm[] | null;
  source_ordinals: number[] | null;
  source_numeric: NumericToken[] | null;
  output_numeric: NumericToken[] | null;
  numeric_status: "pending" | "pass" | "fail";
  terminology_status: "pending" | "review" | "verified";
  status: "draft" | "review" | "approved";
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  updated_at: string;
};

function numericTokens(block: KrReviewBlock): NumericToken[] {
  const value = block.data?.numericTokens;
  if (!Array.isArray(value)) return [];
  return value.filter((token): token is NumericToken => {
    if (!token || typeof token !== "object") return false;
    const item = token as Record<string, unknown>;
    return typeof item.raw === "string" && typeof item.normalized === "string";
  });
}

function tableRows(block: KrReviewBlock): TableCell[][] {
  const value = block.data?.rows;
  if (!Array.isArray(value)) return [];
  return value.filter(Array.isArray).map((row) => row.map((cell) => {
    if (cell && typeof cell === "object" && "text" in (cell as Record<string, unknown>)) {
      const record = cell as Record<string, unknown>;
      return {
        text: String(record.text ?? ""),
        colspan: Number(record.colspan || 1),
        rowspan: Number(record.rowspan || 1),
        header: Boolean(record.header),
      };
    }
    return { text: String(cell ?? ""), colspan: 1, rowspan: 1, header: false };
  }));
}

function imageSource(block: KrReviewBlock) {
  const value = block.data?.src;
  return typeof value === "string" && value ? value : null;
}

function semanticCounts(section: KrSemanticSection) {
  let text = 0;
  let tables = 0;
  let images = 0;
  for (const unit of section.units) {
    if (unit.type === "text") text += 1;
    if (unit.type === "table") tables += 1;
    if (unit.type === "image") images += 1;
  }
  return { text, tables, images };
}

export function KrReviewTabs({
  blocks,
  snapshotId,
  initialAdaptations,
}: {
  blocks: KrReviewBlock[];
  snapshotId: string;
  initialAdaptations: KrStoredAdaptation[];
}) {
  const sections = useMemo(() => assembleSemanticSections(blocks), [blocks]);
  const [tab, setTab] = useState<Tab>("redplay");
  const [adaptations, setAdaptations] = useState<KrStoredAdaptation[]>(initialAdaptations);
  const [adapting, setAdapting] = useState<string | null>(null);
  const [adaptError, setAdaptError] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; title: string | null } | null>(null);
  const numericCount = useMemo(() => blocks.reduce((sum, block) => sum + numericTokens(block).length, 0), [blocks]);
  const adaptationMap = useMemo(() => new Map(adaptations.map((item) => [item.section_id, item])), [adaptations]);
  const pendingCount = useMemo(() => sections.filter((section) => !adaptationMap.has(section.id)).length, [sections, adaptationMap]);

  async function requestAdaptation(section: KrSemanticSection) {
    const response = await fetch("/api/kr-ingest/adapt-section", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ snapshotId, sectionId: section.id }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Не удалось собрать перевод");
    return payload.adaptation as KrStoredAdaptation;
  }

  function saveAdaptation(next: KrStoredAdaptation) {
    setAdaptations((current) => [...current.filter((item) => item.section_id !== next.section_id), next]);
  }

  async function adapt(section: KrSemanticSection) {
    if (bulkRunning) return;
    setAdapting(section.id);
    setAdaptError(null);
    try {
      const next = await requestAdaptation(section);
      saveAdaptation(next);
    } catch (error) {
      setAdaptError(error instanceof Error ? error.message : "Не удалось собрать перевод");
    } finally {
      setAdapting(null);
    }
  }

  async function adaptAll() {
    if (bulkRunning || adapting) return;

    setTab("redplay");
    setBulkRunning(true);
    setAdaptError(null);

    const completed = new Set(adaptations.map((item) => item.section_id));
    let done = completed.size;
    setBulkProgress({ done, total: sections.length, title: null });

    try {
      for (const section of sections) {
        if (completed.has(section.id)) continue;

        setAdapting(section.id);
        setBulkProgress({
          done,
          total: sections.length,
          title: section.titleKr || `Раздел ${done + 1}`,
        });

        const next = await requestAdaptation(section);
        saveAdaptation(next);
        completed.add(section.id);
        done += 1;
        setBulkProgress({ done, total: sections.length, title: null });
      }
    } catch (error) {
      setAdaptError(`${error instanceof Error ? error.message : "Не удалось собрать перевод"} · Уже готовые разделы сохранены. Нажми «Продолжить сборку», чтобы продолжить с оставшихся.`);
    } finally {
      setAdapting(null);
      setBulkRunning(false);
    }
  }

  const bulkLabel = bulkRunning
    ? `Собираю статью ${bulkProgress?.done ?? 0}/${sections.length}…`
    : pendingCount
      ? adaptations.length ? `Продолжить сборку · осталось ${pendingCount}` : `Собрать всю статью · ${sections.length} разделов`
      : "Вся статья собрана";

  return <section style={{ marginTop: 24 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", position: "sticky", top: 68, zIndex: 12, padding: "10px 0", background: "#eef0f4" }}>
      <TabButton active={tab === "redplay"} onClick={() => setTab("redplay")}>REDPLAY</TabButton>
      <TabButton active={tab === "original"} onClick={() => setTab("original")}>ОРИГИНАЛ KR</TabButton>
      <TabButton active={tab === "qa"} onClick={() => setTab("qa")}>ПРОВЕРКА</TabButton>
      {tab === "redplay" ? <button
        type="button"
        className="admin-primary"
        disabled={bulkRunning || Boolean(adapting) || pendingCount === 0}
        onClick={adaptAll}
        style={{ marginLeft: 4 }}
      >{bulkLabel}</button> : null}
      <span style={{ marginLeft: "auto", alignSelf: "center", color: "#858b96", fontSize: 12 }}>{sections.length} смысл. разделов · {numericCount} чисел</span>
    </div>

    {bulkRunning && bulkProgress?.title ? <div style={{ marginBottom: 14, border: "1px solid #cfd8ff", borderRadius: 12, background: "#f4f6ff", padding: 13, color: "#46589b", fontSize: 13 }}>
      Перевожу: <strong>{bulkProgress.title}</strong> · готово {bulkProgress.done} из {bulkProgress.total}. Страница должна оставаться открытой до завершения очереди.
    </div> : null}

    {adaptError ? <div style={{ marginBottom: 14, border: "1px solid #efb4bc", borderRadius: 12, background: "#fff0f2", padding: 13, color: "#a0162a", fontSize: 13 }}>{adaptError}</div> : null}

    {tab === "redplay" ? <RedPlayDraft sections={sections} adaptations={adaptationMap} adapting={adapting} onAdapt={adapt} /> : null}
    {tab === "original" ? <OriginalArticle sections={sections} /> : null}
    {tab === "qa" ? <QaView blocks={blocks} /> : null}
  </section>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} style={{ border: active ? "1px solid #f22d43" : "1px solid #d7dbe2", borderRadius: 999, background: active ? "#f22d43" : "#fff", color: active ? "#fff" : "#626874", padding: "9px 13px", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>{children}</button>;
}

function RedPlayDraft({
  sections,
  adaptations,
  adapting,
  onAdapt,
}: {
  sections: KrSemanticSection[];
  adaptations: Map<string, KrStoredAdaptation>;
  adapting: string | null;
  onAdapt: (section: KrSemanticSection) => void;
}) {
  return <div style={{ display: "grid", gap: 16 }}>
    <div style={{ border: "1px solid #dfe2e8", borderRadius: 16, background: "#fff", padding: 18 }}>
      <strong style={{ fontSize: 16 }}>Semantic Assembler → RedPlay Adaptation</strong>
      <p style={{ marginTop: 6, color: "#747985", fontSize: 13, lineHeight: 1.6 }}>Перевод запускается по смысловому разделу целиком. Модель получает объединённый текст и таблицы, а после ответа отдельный validator проверяет структуру и полный набор числовых значений. Кнопка «Собрать всю статью» запускает эти же безопасные проверки последовательно для всех ещё не готовых разделов.</p>
    </div>

    {sections.map((section, index) => {
      const adaptation = adaptations.get(section.id);
      const counts = semanticCounts(section);
      const isLoading = adapting === section.id;
      return <article key={section.id} style={{ border: "1px solid #dfe2e8", borderRadius: 16, background: "#fff", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: adaptation ? "#17813b" : "#9a6b00", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>{adaptation ? "RU адаптация собрана" : "Ожидает перевода и адаптации"}</div>
            <h2 style={{ marginTop: 7, fontSize: 20, lineHeight: 1.25, fontWeight: 950 }}>{adaptation?.title_ru || section.titleKr || (index === 0 ? "Введение" : `Раздел ${index + 1}`)}</h2>
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
            {adaptation ? <ValidationBadge label={`Цифры: ${adaptation.numeric_status.toUpperCase()}`} ok={adaptation.numeric_status === "pass"} /> : null}
            {adaptation ? <ValidationBadge label={`Структура: ${adaptation.content?.validation?.structure_status?.toUpperCase() || "—"}`} ok={adaptation.content?.validation?.structure_status === "pass"} /> : null}
            <button type="button" className="admin-primary" disabled={Boolean(adapting)} onClick={() => onAdapt(section)}>{isLoading ? "Собираю…" : adaptation ? "Пересобрать" : "Собрать перевод"}</button>
          </div>
        </div>

        {!adaptation ? <>
          <p style={{ marginTop: 8, color: "#747985", fontSize: 13 }}>Секция собрана из {section.units.length} смысловых элементов. Технические RAW-блоки в перевод не превращаются по одному.</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {counts.text ? <MiniBadge>{counts.text} текст.</MiniBadge> : null}
            {counts.tables ? <MiniBadge>{counts.tables} табл.</MiniBadge> : null}
            {counts.images ? <MiniBadge>{counts.images} изобр.</MiniBadge> : null}
            <MiniBadge>{section.numericTokens.length} чисел</MiniBadge>
          </div>
        </> : <AdaptedSection adaptation={adaptation} sourceSection={section} />}

        <details style={{ marginTop: 14, borderTop: "1px solid #edf0f3", paddingTop: 12 }}>
          <summary style={{ cursor: "pointer", color: "#6d7480", fontSize: 12, fontWeight: 850 }}>Показать оригинал KR</summary>
          <div style={{ marginTop: 12 }}><OriginalSection section={section} /></div>
        </details>
      </article>;
    })}
  </div>;
}

function AdaptedSection({ adaptation, sourceSection }: { adaptation: KrStoredAdaptation; sourceSection: KrSemanticSection }) {
  const units = Array.isArray(adaptation.content?.units) ? adaptation.content!.units! : [];
  const terms = Array.isArray(adaptation.terms) ? adaptation.terms : [];
  const issues = adaptation.content?.validation?.structure_issues || [];

  return <div style={{ marginTop: 16 }}>
    <div style={{ display: "grid", gap: 13 }}>
      {units.map((unit, index) => <AdaptedUnitView key={index} unit={unit} sourceUnit={sourceSection.units[index]} />)}
    </div>

    {terms.length ? <details style={{ marginTop: 16, borderTop: "1px solid #edf0f3", paddingTop: 12 }}>
      <summary style={{ cursor: "pointer", color: "#6d7480", fontSize: 12, fontWeight: 850 }}>Терминология · {terms.length} требует проверки</summary>
      <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
        {terms.map((term, index) => <div key={`${term.kr}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(100px,.8fr) minmax(120px,1fr) minmax(140px,1.2fr)", gap: 8, borderRadius: 9, background: "#f5f6f8", padding: 9, fontSize: 12 }}><span>{term.kr}</span><strong>{term.en}</strong><span>{term.display || term.ru} <em style={{ color: "#9a6b00", fontStyle: "normal" }}>⚠ unverified</em></span></div>)}
      </div>
    </details> : null}

    {issues.length ? <div style={{ marginTop: 12, borderRadius: 10, background: "#fff0f2", padding: 10, color: "#a0162a", fontSize: 12 }}>Структурная проверка: {issues.join("; ")}</div> : null}
    <div style={{ marginTop: 10, color: "#9aa0aa", fontSize: 11 }}>{adaptation.model ? `Model: ${adaptation.model}` : ""}{adaptation.input_tokens != null || adaptation.output_tokens != null ? ` · tokens ${adaptation.input_tokens ?? "?"} → ${adaptation.output_tokens ?? "?"}` : ""}</div>
  </div>;
}

function AdaptedUnitView({ unit, sourceUnit }: { unit: AdaptedUnit; sourceUnit: KrSemanticUnit | undefined }) {
  if (unit.type === "table") {
    if (!unit.rows_ru.length) return null;
    const sourceRows = sourceUnit?.type === "table" ? tableRows(sourceUnit.block) : [];
    return <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><tbody>{unit.rows_ru.map((row, r) => <tr key={r}>{row.map((cell, c) => {
      const sourceCell = sourceRows[r]?.[c];
      const isHeader = Boolean(sourceCell?.header) || r === 0;
      return <td key={c} colSpan={sourceCell?.colspan || 1} rowSpan={sourceCell?.rowspan || 1} style={{ border: "1px solid #e1e4e9", background: isHeader ? "#171922" : "#fff", color: isHeader ? "#fff" : "#242832", padding: "9px 10px", fontWeight: isHeader ? 800 : 500, textAlign: "center", verticalAlign: "middle" }}>{cell}</td>;
    })}</tr>)}</tbody></table></div>;
  }
  if (unit.type === "image") {
    const src = sourceUnit?.type === "image" ? imageSource(sourceUnit.block) : null;
    return <figure style={{ margin: "4px 0" }}>{src ? <img src={src} alt={unit.caption_ru || "RedPlay localized source"} style={{ display: "block", width: "100%", maxHeight: 620, objectFit: "contain", borderRadius: 12, background: "#f5f6f8" }} /> : null}{unit.caption_ru ? <figcaption style={{ marginTop: 7, color: "#747985", fontSize: 12 }}>{unit.caption_ru}</figcaption> : null}</figure>;
  }
  return <div style={{ display: "grid", gap: 9 }}>{unit.paragraphs_ru.map((paragraph, index) => <p key={index} style={{ lineHeight: 1.75, fontSize: 14, color: "#2b2f38" }}>{paragraph}</p>)}</div>;
}

function ValidationBadge({ label, ok }: { label: string; ok: boolean }) {
  return <span style={{ borderRadius: 999, background: ok ? "#e8f7ed" : "#fff0f2", padding: "7px 9px", color: ok ? "#17813b" : "#c81931", fontSize: 11, fontWeight: 900 }}>{ok ? "✓ " : "! "}{label}</span>;
}

function MiniBadge({ children }: { children: React.ReactNode }) {
  return <span style={{ borderRadius: 999, background: "#f2f3f5", padding: "5px 8px", color: "#747985", fontSize: 11, fontWeight: 800 }}>{children}</span>;
}

function OriginalArticle({ sections }: { sections: KrSemanticSection[] }) {
  return <article style={{ width: "min(1050px,100%)", margin: "0 auto", border: "1px solid #dfe2e8", borderRadius: 18, background: "#fff", padding: "clamp(18px,3vw,34px)" }}>
    {sections.map((section, index) => <section key={section.id} style={{ marginTop: index ? 32 : 0 }}>
      {section.titleKr ? <h2 style={{ marginBottom: 16, fontSize: 24, lineHeight: 1.25, fontWeight: 950 }}>{section.titleKr}</h2> : null}
      <OriginalSection section={section} />
    </section>)}
  </article>;
}

function OriginalSection({ section }: { section: KrSemanticSection }) {
  return <div style={{ display: "grid", gap: 12 }}>
    {section.sourceBlocks.map((block) => <OriginalBlock key={block.id} block={block} />)}
  </div>;
}

function OriginalBlock({ block }: { block: KrReviewBlock }) {
  if (block.block_type === "table") {
    const rows = tableRows(block);
    if (!rows.length) return null;
    return <div style={{ overflowX: "auto", margin: "4px 0 8px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><tbody>
        {rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} colSpan={cell.colspan || 1} rowSpan={cell.rowspan || 1} style={{ border: "1px solid #e1e4e9", background: cell.header ? "#171922" : rowIndex === 0 ? "#f5f6f8" : "#fff", color: cell.header ? "#fff" : "#242832", padding: "9px 10px", fontWeight: cell.header || rowIndex === 0 ? 800 : 500, verticalAlign: "middle", textAlign: "center" }}>{cell.text}</td>)}</tr>)}
      </tbody></table>
    </div>;
  }

  if (block.block_type === "image") {
    const src = imageSource(block);
    if (!src) return block.text_kr ? <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{block.text_kr}</p> : null;
    return <figure style={{ margin: "8px 0" }}><img src={src} alt={block.text_kr || "KR source image"} style={{ display: "block", width: "100%", maxHeight: 620, objectFit: "contain", borderRadius: 12, background: "#f5f6f8" }} />{block.text_kr ? <figcaption style={{ marginTop: 7, color: "#858b96", fontSize: 12 }}>{block.text_kr}</figcaption> : null}</figure>;
  }

  if (!block.text_kr) return null;
  return <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, fontSize: 14, color: "#2b2f38" }}>{block.text_kr}</p>;
}

function QaView({ blocks }: { blocks: KrReviewBlock[] }) {
  return <div style={{ display: "grid", gap: 10 }}>
    {blocks.map((block) => {
      const tokens = numericTokens(block);
      return <article key={block.id} style={{ border: "1px solid #dfe2e8", borderRadius: 14, background: "#fff", padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, color: "#858b96", fontSize: 11, fontWeight: 850, textTransform: "uppercase" }}>
          <span>#{block.ordinal + 1} · {block.block_type}</span><span>{block.source_type || "html"}</span>
        </div>
        <div style={{ marginTop: 10 }}><OriginalBlock block={block} /></div>
        {tokens.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, paddingTop: 10, borderTop: "1px solid #edf0f3" }}>
          {tokens.map((token, index) => <span key={index} style={{ borderRadius: 999, background: token.kind === "percent" ? "#fff0f2" : "#eef2ff", padding: "5px 8px", color: token.kind === "percent" ? "#c81931" : "#4053a3", fontSize: 11, fontWeight: 850 }}>{token.raw}</span>)}
        </div> : null}
      </article>;
    })}
  </div>;
}