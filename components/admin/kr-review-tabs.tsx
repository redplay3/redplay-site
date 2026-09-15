"use client";

import { useMemo, useState } from "react";

export type KrReviewBlock = {
  id: string;
  ordinal: number;
  block_type: string;
  source_type: string | null;
  text_kr: string | null;
  raw_html: string | null;
  data: Record<string, unknown> | null;
};

type NumericToken = { raw: string; normalized: string; kind: "percent" | "number" };
type TableCell = { text: string; colspan?: number; rowspan?: number; header?: boolean };
type Section = { title: string | null; blocks: KrReviewBlock[] };
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

function buildSections(blocks: KrReviewBlock[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { title: null, blocks: [] };

  for (const block of blocks) {
    if (block.block_type === "heading" && block.text_kr) {
      if (current.title || current.blocks.length) sections.push(current);
      current = { title: block.text_kr, blocks: [] };
      continue;
    }
    current.blocks.push(block);
  }

  if (current.title || current.blocks.length) sections.push(current);
  return sections;
}

export function KrReviewTabs({ blocks }: { blocks: KrReviewBlock[] }) {
  const sections = useMemo(() => buildSections(blocks), [blocks]);
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

function RedPlayDraft({ sections }: { sections: Section[] }) {
  return <div style={{ display: "grid", gap: 16 }}>
    <div style={{ border: "1px solid #dfe2e8", borderRadius: 16, background: "#fff", padding: 18 }}>
      <strong style={{ fontSize: 16 }}>Редакционная версия ещё не собрана</strong>
      <p style={{ marginTop: 6, color: "#747985", fontSize: 13, lineHeight: 1.6 }}>Следующий этап будет собирать из исходной структуры нормальные разделы RedPlay, переводить их целиком и только потом создавать публикацию. Технические микроблоки сюда не попадут.</p>
    </div>

    {sections.map((section, index) => <article key={index} style={{ border: "1px solid #dfe2e8", borderRadius: 16, background: "#fff", padding: 18 }}>
      <div style={{ color: "#9a6b00", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>Ожидает адаптации</div>
      <h2 style={{ marginTop: 7, fontSize: 20, fontWeight: 950 }}>{section.title || (index === 0 ? "Введение" : `Раздел ${index + 1}`)}</h2>
      <p style={{ marginTop: 8, color: "#747985", fontSize: 13 }}>Источник собран в {section.blocks.length} структурных элементов. Здесь появится единый русский раздел, а не перевод каждого элемента отдельно.</p>
      <details style={{ marginTop: 14, borderTop: "1px solid #edf0f3", paddingTop: 12 }}>
        <summary style={{ cursor: "pointer", color: "#6d7480", fontSize: 12, fontWeight: 850 }}>Показать оригинал KR</summary>
        <div style={{ marginTop: 12 }}><OriginalSection section={section} /></div>
      </details>
    </article>)}
  </div>;
}

function OriginalArticle({ sections }: { sections: Section[] }) {
  return <article style={{ width: "min(1050px,100%)", margin: "0 auto", border: "1px solid #dfe2e8", borderRadius: 18, background: "#fff", padding: "clamp(18px,3vw,34px)" }}>
    {sections.map((section, index) => <section key={index} style={{ marginTop: index ? 32 : 0 }}>
      {section.title ? <h2 style={{ marginBottom: 16, fontSize: 24, lineHeight: 1.25, fontWeight: 950 }}>{section.title}</h2> : null}
      <OriginalSection section={section} />
    </section>)}
  </article>;
}

function OriginalSection({ section }: { section: Section }) {
  return <div style={{ display: "grid", gap: 12 }}>
    {section.blocks.map((block) => <OriginalBlock key={block.id} block={block} />)}
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
