import type { CSSProperties, ReactNode } from "react";

export type StructuredPlayncCell = {
  text: string;
  colspan?: number;
  rowspan?: number;
  header?: boolean;
};

function numericLike(value: string) {
  return /^[+\-]?\d[\d\s,./~:%+\-]*(?:\s*(?:шт\.|ур\.|уровень|уровни|адена|аден|руды духов))?$/i.test(value.trim());
}

function splitLines(value: string) {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function boldLabelLine(line: string) {
  const match = line.match(/^([^:]{2,55}):\s*(.*)$/);
  if (!match) return null;
  const label = match[1].trim();
  const value = match[2].trim();
  if (!value) return null;
  return { label, value };
}

function isSubheading(line: string) {
  if (line.endsWith(":")) return true;
  if (/^[A-Z][A-Za-z0-9' :+\-]+\s*\([^)]{2,80}\)$/.test(line)) return true;
  if (/^В течение \d+ .+:$/i.test(line)) return true;
  return false;
}

function RangeTable({ rows, label, valueLabel }: { rows: Array<[string, string]>; label: string; valueLabel: string }) {
  if (!rows.length) return null;
  return <div style={{ margin: "13px 0 14px", overflowX: "auto", border: "1px solid #e1e5eb", borderRadius: 10 }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
      <thead><tr>
        <th style={miniHead}>{label}</th>
        <th style={miniHead}>{valueLabel}</th>
      </tr></thead>
      <tbody>{rows.map(([range, value], index) => <tr key={`${range}-${index}`}>
        <td style={miniCell}>{range}</td>
        <td style={{ ...miniCell, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{value}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

const miniHead: CSSProperties = {
  padding: "9px 12px",
  background: "#f0f2f5",
  color: "#4a505b",
  borderBottom: "1px solid #dde2e8",
  textAlign: "center",
  fontWeight: 850,
};

const miniCell: CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #edf0f3",
  textAlign: "center",
};

function SkillBody({ value }: { value: string }) {
  const lines = splitLines(value);
  const output: ReactNode[] = [];
  let rangeRows: Array<[string, string]> = [];
  let rangeLabel = "Диапазон";
  let valueLabel = "Значение";

  const flushRanges = () => {
    if (!rangeRows.length) return;
    output.push(<RangeTable key={`ranges-${output.length}`} rows={rangeRows} label={rangeLabel} valueLabel={valueLabel} />);
    rangeRows = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const range = line.match(/^(Dominance|Власть|Контроль|Превосходство)\s+(.+)$/i);
    const next = lines[index + 1] || "";
    const rangeValue = next.match(/^[-–]?\s*(HP[^:]{0,50}):\s*(.+)$/i);
    if (range && rangeValue) {
      rangeLabel = range[1];
      valueLabel = rangeValue[1];
      rangeRows.push([range[2].replace(/~/g, "–"), rangeValue[2]]);
      index += 1;
      continue;
    }

    flushRanges();

    if (isSubheading(line)) {
      output.push(<div key={index} style={{ marginTop: output.length ? 11 : 0, fontWeight: 900, color: "#20242c" }}>{line.replace(/:$/, "")}</div>);
      continue;
    }

    if (/^[-–]\s*/.test(line)) {
      output.push(<div key={index} style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 4, color: "#353a44" }}><span>•</span><span>{line.replace(/^[-–]\s*/, "")}</span></div>);
      continue;
    }

    const pair = boldLabelLine(line);
    if (pair) {
      output.push(<div key={index} style={{ color: "#30353e" }}><strong style={{ fontWeight: 850 }}>{pair.label}:</strong> {pair.value}</div>);
      continue;
    }

    output.push(<div key={index} style={{ color: "#353a44" }}>{line}</div>);
  }
  flushRanges();
  return <div style={{ display: "grid", gap: 7, padding: "14px 16px 16px", fontSize: 13.5, lineHeight: 1.55 }}>{output}</div>;
}

function oneColumnSkillCard(cells: StructuredPlayncCell[][]) {
  const title = cells[0]?.map((cell) => cell.text).filter(Boolean).join(" · ") || "Навык";
  const body = cells.slice(1).flat().map((cell) => cell.text).filter(Boolean).join("\n");
  return <section style={{ border: "1px solid #dfe3e9", borderRadius: 13, background: "#fff", overflow: "hidden" }}>
    <div style={{ background: "#171922", color: "#fff", padding: "10px 14px", textAlign: "center", fontWeight: 900, fontSize: 14 }}>{title}</div>
    <SkillBody value={body} />
  </section>;
}

export function StructuredPlayncTable({ cells }: { cells: StructuredPlayncCell[][] }) {
  if (!cells.length) return null;
  const maxLogicalCols = Math.max(1, ...cells.map((row) => row.reduce((sum, cell) => sum + Math.max(1, cell.colspan || 1), 0)));
  if (maxLogicalCols <= 1) return oneColumnSkillCard(cells);

  const minWidth = maxLogicalCols >= 7 ? 1180 : maxLogicalCols >= 6 ? 1040 : maxLogicalCols >= 5 ? 900 : maxLogicalCols >= 4 ? 760 : maxLogicalCols >= 3 ? 620 : 520;

  return <div style={{ overflowX: "auto", border: "1px solid #dfe3e9", borderRadius: 13, background: "#fff" }}>
    <table style={{ width: "100%", minWidth, borderCollapse: "collapse", fontSize: 13, tableLayout: "auto" }}>
      <tbody>{cells.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => {
        const isHeader = Boolean(cell.header);
        const longText = cell.text.length > 80 || cell.text.includes("\n");
        const shortGrouped = (cell.rowspan || 1) > 1 && cell.text.length <= 80;
        const centered = isHeader || numericLike(cell.text) || shortGrouped;
        const groupedTitle = !isHeader && (cell.rowspan || 1) > 1 && cellIndex === 0;
        return <td
          key={cellIndex}
          colSpan={cell.colspan || 1}
          rowSpan={cell.rowspan || 1}
          style={{
            borderRight: "1px solid #e0e4ea",
            borderBottom: "1px solid #e0e4ea",
            background: isHeader ? "#171922" : "#fff",
            color: isHeader ? "#fff" : "#242832",
            padding: isHeader ? "10px 12px" : "9px 11px",
            fontWeight: isHeader || groupedTitle ? 850 : 500,
            textAlign: centered ? "center" : "left",
            verticalAlign: shortGrouped || isHeader ? "middle" : "top",
            minWidth: centered ? 74 : longText ? 210 : 130,
            maxWidth: longText ? 430 : 300,
            wordBreak: "break-word",
            whiteSpace: "pre-line",
            lineHeight: 1.5,
          }}
        >{cell.text}</td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}
