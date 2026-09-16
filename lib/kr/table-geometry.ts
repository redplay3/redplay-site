export type KrTableCell = {
  text: string;
  colspan: number;
  rowspan: number;
  header: boolean;
};

type BlockLike = {
  data?: Record<string, unknown> | null;
};

function positiveInt(value: unknown) {
  const parsed = Number(value || 1);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
}

export function sourceTableCells(block: BlockLike): KrTableCell[][] {
  const value = block.data?.rows;
  if (!Array.isArray(value)) return [];
  return value.filter(Array.isArray).map((row) => row.map((cell) => {
    if (cell && typeof cell === "object") {
      const record = cell as Record<string, unknown>;
      return {
        text: String(record.text ?? ""),
        colspan: positiveInt(record.colspan),
        rowspan: positiveInt(record.rowspan),
        header: Boolean(record.header),
      };
    }
    return { text: String(cell ?? ""), colspan: 1, rowspan: 1, header: false };
  }));
}

export function sourceTableTextRows(block: BlockLike): string[][] {
  return sourceTableCells(block).map((row) => row.map((cell) => cell.text));
}

function sourceCellColumns(rows: KrTableCell[][]) {
  const active: number[] = [];
  const result: number[][] = [];

  for (const row of rows) {
    const occupied = active.map((remaining) => remaining > 0);
    for (let col = 0; col < active.length; col += 1) {
      if (active[col] > 0) active[col] -= 1;
    }

    const positions: number[] = [];
    let cursor = 0;
    for (const cell of row) {
      while (occupied[cursor]) cursor += 1;
      positions.push(cursor);

      for (let col = cursor; col < cursor + cell.colspan; col += 1) {
        occupied[col] = true;
        if (cell.rowspan > 1) active[col] = Math.max(active[col] || 0, cell.rowspan - 1);
      }
      cursor += cell.colspan;
    }
    result.push(positions);
  }
  return result;
}

function sameRow(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function removeSafeDuplicateRows(rows: string[][], targetLength: number) {
  if (rows.length <= targetLength) return rows;
  const next: string[][] = [];
  let surplus = rows.length - targetLength;
  for (const row of rows) {
    if (surplus > 0 && next.length && sameRow(next[next.length - 1], row)) {
      surplus -= 1;
      continue;
    }
    next.push(row);
  }
  return next;
}

/**
 * AI models often expand rowspan/colspan tables into a rectangular matrix by
 * inserting empty placeholders. PLAYNC stores only the physical TD/TH cells.
 * This function maps the translated matrix back onto the exact physical source
 * geometry without changing any non-empty translated values.
 */
export function normalizeTranslatedTableRows(block: BlockLike, translatedRows: string[][]) {
  const sourceRows = sourceTableCells(block);
  if (!sourceRows.length) return translatedRows.map((row) => [...row]);

  const rows = removeSafeDuplicateRows(
    translatedRows.map((row) => row.map((cell) => String(cell ?? ""))),
    sourceRows.length,
  );
  const positions = sourceCellColumns(sourceRows);

  return rows.map((row, rowIndex) => {
    const sourceRow = sourceRows[rowIndex];
    if (!sourceRow || row.length === sourceRow.length) return [...row];
    if (row.length < sourceRow.length) return [...row];

    const mapped = positions[rowIndex].map((column) => row[column] ?? "");
    if (mapped.length === sourceRow.length && mapped.some((cell) => cell.trim())) return mapped;

    const nonEmpty = row.filter((cell) => cell.trim() !== "");
    if (nonEmpty.length === sourceRow.length) return nonEmpty;

    return mapped;
  });
}

export function translatedTableShapeIssues(block: BlockLike, translatedRows: string[][]) {
  const sourceRows = sourceTableCells(block);
  const normalized = normalizeTranslatedTableRows(block, translatedRows);
  const issues: string[] = [];

  if (sourceRows.length !== normalized.length) {
    issues.push(`строк ${sourceRows.length} → ${normalized.length}`);
  }
  const count = Math.min(sourceRows.length, normalized.length);
  for (let row = 0; row < count; row += 1) {
    if (sourceRows[row].length !== normalized[row].length) {
      issues.push(`строка ${row + 1}: ячеек ${sourceRows[row].length} → ${normalized[row].length}`);
    }
  }
  return issues;
}
