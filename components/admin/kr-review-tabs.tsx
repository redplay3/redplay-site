"use client";

import { useMemo, useState } from "react";
import { assembleSemanticSections, type KrSemanticSection, type KrSemanticSourceBlock } from "@/lib/kr/semantic";

export type KrReviewBlock = KrSemanticSourceBlock;

type NumericToken = { raw: string; normalized: string; kind: "percent" | "number" };
type TableCell = { text: string; colspan?: number; rowspan?: number; header?: boolean };
type Tab = "redplay" | "original" | "qa";

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

export function KrReviewTabs({ blocks }: { blocks: KrReviewBlock[] }) {
  const sections = useMemo(() => assembleSemanticSections(blocks), [blocks]);
  const [tab, setTab] = useState<Tab>("original");
  const numericCount = useMemo(() => blocks.reduce((sum, block) => sum + numericTokens(block).length, 0), [blocks]);

  return <section style={{ marginTop: 24 }}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", position: "sticky", top: 68, zIndex: 12, padding: "10px 0", background: "#eef0f4" }}>
      <TabButton active={tab === "redplay"} onClick={() => setTab("redplay")}>REDPLAY</TabButton>
      <TabButton active={tab === "original"} onClick={() => setTab("original")}>ОРИГИНАЛ KR</TabButton>
      <TabButton active={tab === "qa"} onClick={() => setTab("qa")}>ПРОВЕРКА</TabButton>
      <span style={{ marginLeft: "auto", alignSelf: "center", color: "#858b96", fontSize: 12 }}>{sections.length} смысл. разделов · {numericCount} чисел</span>
    </div>

    {tab === "redplay" ? <RedPlayDraft sections={sections} /> : null}
    {tab === "original" ? <OriginalArticle sections={sections} /> : null}
    {tab === "qa" ? <QaView blocks={blocks} /> : null}
  </section>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} style={{ border: active ? "1px solid #f22d43" : "1px solid #d7dbe2", borderRadius: 999, background: active ? "#f22d43" : "#fff", color: active ? "#fff" : "#626874", padding: "9px 13px", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>{children}</button>;
}

function RedPlayDraft({ sections }: { sections: KrSemanticSection[] }) {
  return <div style={{ display: "grid", gap: 16 }}>
    <div style={{ border: "1px solid #dfe2e8", borderRadius: 16, background: "#fff", padding: 18 }}>
      <strong style={{ fontSize: 16 }}>Semantic Assembler готовит структуру RedPlay</strong>
      <p style={{ marginTop: 6, color: "#747985", fontSize: 13, lineHeight: 1.6 }}>RAW-блоки больше не являются будущими абзацами статьи. Соседние фрагменты текста объединяются в смысловой текстовый узел, таблицы и изображения остаются самостоятельными элементами, а номера исходных блоков сохраняются только для QA.</p>
    </div>

    {sections.map((section, index) => {
      const textUnits = section.units.filter((unit) => unit.type === "text").length;
      const tables = section.units.filter((unit) => unit.type === "table").length;
      const images = section.units.filter((unit) => unit.type === "image").length;
      return <article key={section.id} style={{ border: "1px solid #dfe2e8", borderRadius: 16, background: "#fff", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ color: "#9a6b00", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>Ожидает перевода и адаптации</div>
          <div style={{ color: "#8a909a", fontSize: 11 }}>{section.kind.toUpperCase()} · {section.numericTokens.length} чисел</div>
        </div>
        <h2 style={{ marginTop: 7, fontSize: 20, lineHeight: 1.3, fontWeight: 950 }}>{section.titleKr || (index === 0 ? "Введение" : `Раздел ${index + 1}`)}</h2>
        <p style={{ marginTop: 8, color: "#747985", fontSize: 13, lineHeight: 1.6 }}>Будущий русский раздел собирается целиком из {section.units.length} смысловых элементов, а не из {section.sourceBlocks.length} технических фрагментов.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {textUnits ? <UnitBadge>{textUnits} текст.</UnitBadge> : null}
          {tables ? <UnitBadge>{tables} табл.</UnitBadge> : null}
          {images ? <UnitBadge>{images} изобр.</UnitBadge> : null}
        </div>
        <details style={{ marginTop: 14, borderTop: "1px solid #edf0f3", paddingTop: 12 }}>
          <summary style={{ cursor: "pointer", color: "#6d7480", fontSize: 12, fontWeight: 850 }}>Показать оригинал KR</summary>
          <div style={{ marginTop: 12 }}><OriginalSection section={section} /></div>
        </details>
      </article>;
    })}
  </div>;
}

function UnitBadge({ children }: { children: React.ReactNode }) {
  return <span style={{ borderRadius: 999, background: "#f2f3f5", padding: "5px 8px", color: "#6f7580", fontSize: 11, fontWeight: 850 }}>{children}</span>;
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
