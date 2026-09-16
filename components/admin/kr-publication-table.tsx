export type PublicationTableCell = {
  text: string;
  colspan?: number;
  rowspan?: number;
  header?: boolean;
};

function numericLike(value: string) {
  const trimmed = value.trim();
  return /^[+\-]?\d[\d\s,./~:%+\-]*(?:\s*(?:шт\.|ур\.|уровень|уровни|адена|аден))?$/i.test(trimmed)
    || /^\d{1,2}:\d{2}(?:\s*[~–-]\s*\d{1,2}:\d{2})?$/.test(trimmed)
    || /^Ежедневно\s+\d{1,2}:\d{2}/i.test(trimmed)
    || /^\d[\d\s,.]*\s*(?:шт\.?|аден(?:а|ы)?|сек\.?|мин\.?)\b/i.test(trimmed);
}

function lines(value: string) {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function looksLikeStandaloneSubheading(value: string) {
  const line = value.trim();
  return /^(?:Dominance|Власть|Контроль)\s+\d/i.test(line)
    || /^(?:Iron Wall|Aftershock|Judgment Spear|Lightning Scar|Storm Rainforce|Spear Shock)\b/i.test(line);
}

function BodyLine({ value }: { value: string }) {
  if (looksLikeStandaloneSubheading(value)) {
    return <div style={{ fontWeight: 780, marginTop: 2 }}>{value}</div>;
  }

  const labelled = value.match(/^([^:]{1,44}:)\s*(.*)$/);
  if (labelled) {
    return <div><strong style={{ fontWeight: 760 }}>{labelled[1]}</strong>{labelled[2] ? ` ${labelled[2]}` : ""}</div>;
  }

  return <div style={{ fontWeight: 500 }}>{value}</div>;
}

function CellLines({ value, strong = false }: { value: string; strong?: boolean }) {
  const parts = lines(value);
  if (!parts.length) return null;
  return <div style={{ display: "grid", gap: 5, whiteSpace: "normal", lineHeight: 1.48 }}>
    {parts.map((part, index) => strong
      ? <div key={index} style={{ fontWeight: 850 }}>{part}</div>
      : <BodyLine key={index} value={part} />)}
  </div>;
}

/**
 * Publication view deliberately preserves PLAYNC's physical table structure.
 * rowspan/colspan are part of the meaning (especially enchant tables), so RedPlay
 * changes only language and visual styling, never the table geometry.
 */
export function KrPublicationTable({
  rowsRu,
  sourceRows,
}: {
  rowsRu: string[][];
  sourceRows: PublicationTableCell[][];
}) {
  if (!rowsRu.length) return null;

  const maxLogicalCols = Math.max(
    1,
    ...sourceRows.map((row) => row.reduce((sum, cell) => sum + Math.max(1, cell.colspan || 1), 0)),
  );

  // PLAYNC uses rowspan=2 on the columns that span a genuinely layered header.
  // A plain colspan (for example "Изготавливаемый предмет" spanning two physical
  // columns) does NOT mean that the first data row is a second header row.
  const hasLayeredHeader = Boolean(sourceRows[0]?.some((cell) =>
    Boolean(cell.header) && (cell.rowspan || 1) > 1));
  const headerRows = hasLayeredHeader ? 2 : 1;

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
      <tbody>
        {rowsRu.map((row, rowIndex) => <tr key={rowIndex}>
          {row.map((cell, cellIndex) => {
            const sourceCell = sourceRows[rowIndex]?.[cellIndex];
            const isHeader = Boolean(sourceCell?.header) || rowIndex < headerRows;
            const longText = cell.length > 80 || cell.includes("\n");
            const groupedKey = !isHeader && (sourceCell?.rowspan || 1) > 1 && !longText;
            const centered = isHeader || numericLike(cell) || groupedKey;
            const middle = isHeader || groupedKey || (numericLike(cell) && (sourceCell?.rowspan || 1) > 1);

            return <td
              key={cellIndex}
              colSpan={sourceCell?.colspan || 1}
              rowSpan={sourceCell?.rowspan || 1}
              style={{
                borderRight: "1px solid #e0e4ea",
                borderBottom: "1px solid #e0e4ea",
                background: isHeader ? (rowIndex === 0 ? "#171922" : "#252833") : "#fff",
                color: isHeader ? "#fff" : "#242832",
                padding: isHeader ? "10px 12px" : "9px 11px",
                fontWeight: isHeader ? 850 : groupedKey ? 700 : 500,
                textAlign: centered ? "center" : "left",
                verticalAlign: middle ? "middle" : "top",
                minWidth: centered ? 74 : longText ? 210 : 130,
                maxWidth: longText ? 430 : 280,
                wordBreak: "break-word",
              }}
            >
              <CellLines value={cell} strong={isHeader} />
            </td>;
          })}
        </tr>)}
      </tbody>
    </table>
  </div>;
}
