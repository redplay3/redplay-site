export type StructuredPlayncCell = {
  text: string;
  colspan?: number;
  rowspan?: number;
  header?: boolean;
  background?: string | null;
  color?: string | null;
  align?: "left" | "center" | "right" | null;
  bold?: boolean;
};

function numericLike(value: string) {
  const trimmed = value.trim();
  return /^[+\-]?\d[\d\s,./~:%+\-]*(?:\s*(?:шт\.|ур\.|уровень|уровни|адена|аден|руды духов))?$/i.test(trimmed)
    || /^\d{1,2}:\d{2}(?:\s*[~–-]\s*\d{1,2}:\d{2})?$/.test(trimmed)
    || /^Ежедневно\s+\d{1,2}:\d{2}/i.test(trimmed);
}

function isDark(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.toLowerCase().replace(/\s+/g, "");
  return normalized === "black"
    || normalized === "#000"
    || normalized === "#000000"
    || normalized === "rgb(0,0,0)"
    || normalized === "rgba(0,0,0,1)";
}

function renderCellText(value: string, forceBold: boolean) {
  const lines = value.split(/\n/);
  return <div style={{ display: "grid", gap: 3, whiteSpace: "normal", lineHeight: 1.48 }}>
    {lines.map((line, index) => {
      if (!line.trim()) return <div key={index} style={{ height: 5 }} />;
      const labelled = line.match(/^([^:]{1,48}:)\s*(.*)$/);
      if (!forceBold && labelled) {
        return <div key={index}><strong style={{ fontWeight: 760 }}>{labelled[1]}</strong>{labelled[2] ? ` ${labelled[2]}` : ""}</div>;
      }
      return <div key={index} style={{ fontWeight: forceBold ? 850 : 500 }}>{line}</div>;
    })}
  </div>;
}

/**
 * Source-faithful PLAYNC table renderer.
 * Geometry and cell presentation come from the official source HTML.
 * RedPlay only changes the translated cell text and general spacing/typography.
 */
export function StructuredPlayncTable({ cells }: { cells: StructuredPlayncCell[][] }) {
  if (!cells.length) return null;

  const maxLogicalCols = Math.max(
    1,
    ...cells.map((row) => row.reduce((sum, cell) => sum + Math.max(1, cell.colspan || 1), 0)),
  );
  const minWidth = maxLogicalCols >= 7
    ? 1180
    : maxLogicalCols >= 6
      ? 1040
      : maxLogicalCols >= 5
        ? 900
        : maxLogicalCols >= 4
          ? 760
          : maxLogicalCols >= 3
            ? 620
            : maxLogicalCols === 2
              ? 520
              : 420;

  return <div style={{ overflowX: "auto", border: "1px solid #dfe3e9", borderRadius: 13, background: "#fff" }}>
    <table style={{ width: "100%", minWidth, borderCollapse: "collapse", fontSize: 13, tableLayout: "auto" }}>
      <tbody>{cells.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => {
        const sourceDark = isDark(cell.background);
        const visualHeader = Boolean(cell.header) || sourceDark;
        const longText = cell.text.length > 80 || cell.text.includes("\n");
        const shortGrouped = (cell.rowspan || 1) > 1 && cell.text.length <= 80;
        const align = cell.align || (visualHeader || numericLike(cell.text) || shortGrouped ? "center" : "left");
        const middle = shortGrouped || visualHeader;
        const background = cell.background || (cell.header ? "#171922" : "#fff");
        const color = cell.color || (sourceDark || cell.header ? "#fff" : "#242832");
        const forceBold = Boolean(cell.bold) || Boolean(cell.header) || sourceDark;

        return <td
          key={cellIndex}
          colSpan={cell.colspan || 1}
          rowSpan={cell.rowspan || 1}
          style={{
            borderRight: "1px solid #e0e4ea",
            borderBottom: "1px solid #e0e4ea",
            background,
            color,
            padding: visualHeader ? "10px 12px" : "9px 11px",
            fontWeight: forceBold ? 850 : 500,
            textAlign: align,
            verticalAlign: middle ? "middle" : "top",
            minWidth: align === "center" ? 74 : longText ? 210 : 130,
            maxWidth: longText ? 460 : 300,
            wordBreak: "break-word",
          }}
        >{renderCellText(cell.text, forceBold)}</td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}
