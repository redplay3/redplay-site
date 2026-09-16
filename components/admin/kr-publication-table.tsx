import type { CSSProperties, ReactNode } from "react";

export type PublicationTableCell = {
  text: string;
  colspan?: number;
  rowspan?: number;
  header?: boolean;
};

function numericLike(value: string) {
  return /^[+\-]?\d[\d\s,./~:%+\-]*(?:\s*(?:шт\.|ур\.|уровень|уровни|адена|аден))?$/i.test(value.trim());
}

function lines(value: string) {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function CellLines({ value, strong = false }: { value: string; strong?: boolean }) {
  const parts = lines(value);
  if (!parts.length) return null;
  return <div style={{ display: "grid", gap: 5, whiteSpace: "normal", lineHeight: 1.48 }}>
    {parts.map((part, index) => <div key={index} style={{ fontWeight: strong && index === 0 ? 800 : 500 }}>{part}</div>)}
  </div>;
}

function oneColumnCard(rowsRu: string[][]) {
  const title = rowsRu[0]?.filter(Boolean).join(" · ") || "";
  const body = rowsRu.slice(1).flat().filter(Boolean);
  return <section style={{ border: "1px solid #e0e4ea", borderRadius: 14, overflow: "hidden", background: "#fafbfc" }}>
    {title ? <div style={{ background: "#171922", color: "#fff", padding: "11px 14px", fontWeight: 900, fontSize: 14 }}>{title}</div> : null}
    <div style={{ padding: "14px 16px", display: "grid", gap: 9, color: "#2b2f38", fontSize: 13.5, lineHeight: 1.6 }}>
      {body.map((value, index) => <CellLines key={index} value={value} />)}
    </div>
  </section>;
}

function isLevelProgression(sourceRows: PublicationTableCell[][], rowsRu: string[][]) {
  if (sourceRows.length < 5 || rowsRu.length < 5) return false;
  const header = (rowsRu[0] || []).join(" ").toLowerCase();
  const hasLevelColumns = /уровень/.test(header) && /(изуч|осво|получ)/.test(header);
  const hasLongGroup = sourceRows.slice(1).some((row) => (row[0]?.rowspan || 1) >= 4);
  return hasLevelColumns && hasLongGroup;
}

function progressionTable(sourceRows: PublicationTableCell[][], rowsRu: string[][]) {
  const header = rowsRu[0] || [];
  const levelLabel = header[1] || "Уровень";
  const learnLabel = header[2] || "Уровень изучения";
  const cards: ReactNode[] = [];

  let rowIndex = 1;
  while (rowIndex < sourceRows.length && rowIndex < rowsRu.length) {
    const sourceRow = sourceRows[rowIndex];
    const row = rowsRu[rowIndex] || [];
    const span = Math.max(1, Number(sourceRow?.[0]?.rowspan || 1));

    if (span <= 1 || row.length < 3) {
      rowIndex += 1;
      continue;
    }

    const name = row[0] || "Навык";
    const firstLevel = row[1] || "";
    const firstLearn = row[2] || "";
    const staticDetails = row.slice(3).filter((value) => value.trim());
    const levels: Array<[string, string]> = [[firstLevel, firstLearn]];

    for (let offset = 1; offset < span && rowIndex + offset < rowsRu.length; offset += 1) {
      const next = rowsRu[rowIndex + offset] || [];
      if (next.length >= 2) levels.push([next[0] || "", next[1] || ""]);
    }

    cards.push(<section key={`${rowIndex}-${name}`} style={{ border: "1px solid #dfe3e9", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
      <div style={{ background: "#171922", color: "#fff", padding: "12px 15px", fontWeight: 900, fontSize: 15 }}>{name}</div>
      {staticDetails.length ? <div style={{ padding: "13px 15px", background: "#f7f8fa", borderBottom: "1px solid #e5e8ed", display: "grid", gap: 10 }}>
        {staticDetails.map((value, index) => <div key={index} style={{ color: "#343943", fontSize: 13.5 }}><CellLines value={value} /></div>)}
      </div> : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>
            <th style={miniHead}>{levelLabel}</th>
            <th style={miniHead}>{learnLabel}</th>
          </tr></thead>
          <tbody>{levels.map(([level, learn], index) => <tr key={index}>
            <td style={miniCell}>{level}</td>
            <td style={miniCell}>{learn}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>);

    rowIndex += span;
  }

  return <div style={{ display: "grid", gap: 14 }}>{cards}</div>;
}

const miniHead: CSSProperties = {
  padding: "8px 12px",
  background: "#f0f2f5",
  borderBottom: "1px solid #dfe3e9",
  textAlign: "center",
  fontWeight: 850,
  color: "#4b515c",
};
const miniCell: CSSProperties = {
  padding: "7px 12px",
  borderBottom: "1px solid #edf0f3",
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
};

export function KrPublicationTable({
  rowsRu,
  sourceRows,
}: {
  rowsRu: string[][];
  sourceRows: PublicationTableCell[][];
}) {
  if (!rowsRu.length) return null;

  const maxPhysicalCells = Math.max(0, ...sourceRows.map((row) => row.length));
  const maxLogicalCols = Math.max(0, ...sourceRows.map((row) => row.reduce((sum, cell) => sum + Math.max(1, cell.colspan || 1), 0)));
  if (maxLogicalCols <= 1 || maxPhysicalCells <= 1) return oneColumnCard(rowsRu);
  if (isLevelProgression(sourceRows, rowsRu)) return progressionTable(sourceRows, rowsRu);

  const minWidth = maxLogicalCols >= 6 ? 980 : maxLogicalCols >= 5 ? 820 : maxLogicalCols >= 4 ? 680 : 520;
  return <div style={{ overflowX: "auto", border: "1px solid #e0e4ea", borderRadius: 13, background: "#fff" }}>
    <table style={{ width: "100%", minWidth, borderCollapse: "collapse", fontSize: 13, tableLayout: "auto" }}>
      <tbody>{rowsRu.map((row, r) => <tr key={r}>{row.map((cell, c) => {
        const sourceCell = sourceRows[r]?.[c];
        const isHeader = Boolean(sourceCell?.header) || r === 0;
        const centered = isHeader || numericLike(cell);
        return <td
          key={c}
          colSpan={sourceCell?.colspan || 1}
          rowSpan={sourceCell?.rowspan || 1}
          style={{
            borderRight: "1px solid #e1e4e9",
            borderBottom: "1px solid #e1e4e9",
            background: isHeader ? "#171922" : "#fff",
            color: isHeader ? "#fff" : "#242832",
            padding: "10px 12px",
            fontWeight: isHeader ? 850 : 500,
            textAlign: centered ? "center" : "left",
            verticalAlign: "top",
            minWidth: centered ? 86 : 150,
            maxWidth: 520,
          }}
        ><CellLines value={cell} strong={isHeader} /></td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}
