import { StructuredPlayncTable, type StructuredPlayncCell } from "@/components/structured-plaync-table";

export type PublicationTableCell = StructuredPlayncCell;

/**
 * Preview uses the exact PLAYNC geometry and overlays only the translated text.
 * The same structured renderer is also used by the public article renderer.
 */
export function KrPublicationTable({
  rowsRu,
  sourceRows,
}: {
  rowsRu: string[][];
  sourceRows: PublicationTableCell[][];
}) {
  if (!rowsRu.length) return null;
  const hasLayeredHeader = Boolean(sourceRows[0]?.some((cell) => Boolean(cell.header) && (cell.rowspan || 1) > 1));
  const headerRows = hasLayeredHeader ? 2 : 1;
  const cells: StructuredPlayncCell[][] = sourceRows.map((row, rowIndex) => row.map((cell, cellIndex) => ({
    ...cell,
    text: String(rowsRu[rowIndex]?.[cellIndex] ?? cell.text ?? ""),
    header: Boolean(cell.header) || rowIndex < headerRows,
  })));
  return <StructuredPlayncTable cells={cells} />;
}
