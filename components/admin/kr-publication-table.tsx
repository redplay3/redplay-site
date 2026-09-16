import { StructuredPlayncTable, type StructuredPlayncCell } from "@/components/structured-plaync-table";

export type PublicationTableCell = StructuredPlayncCell;

/**
 * Preview uses the exact PLAYNC geometry and cell presentation and overlays only
 * the translated text. No header/column inference is performed here.
 */
export function KrPublicationTable({
  rowsRu,
  sourceRows,
}: {
  rowsRu: string[][];
  sourceRows: PublicationTableCell[][];
}) {
  if (!rowsRu.length) return null;
  const cells: StructuredPlayncCell[][] = sourceRows.map((row, rowIndex) => row.map((cell, cellIndex) => ({
    ...cell,
    text: String(rowsRu[rowIndex]?.[cellIndex] ?? cell.text ?? ""),
  })));
  return <StructuredPlayncTable cells={cells} />;
}
