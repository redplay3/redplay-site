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

function invariantNumericCell(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[+\-]?\d[\d\s,./~:%+\-]*$/.test(trimmed);
}

function restoreInvariantCells(sourceRow: KrTableCell[], translatedRow: string[]) {
  if (translatedRow.length !== sourceRow.length) return translatedRow;
  return translatedRow.map((value, index) => {
    const source = sourceRow[index]?.text || "";
    return invariantNumericCell(source) ? source : value;
  });
}

/**
 * AI models may represent rowspan tables in two different ways:
 * 1) physical cells + trailing empty placeholders: ["2", "43", ""];
 * 2) full logical grid placeholders: ["", "2", "79", "", ""].
 * PLAYNC stores only physical TD/TH cells. Prefer the non-empty physical values
 * when their count already matches the source row, then fall back to logical
 * column positions derived from rowspan/colspan. Pure numeric source cells are
 * restored verbatim because they never need translation and must never drift.
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
    if (!sourceRow) return [...row];

    let normalized: string[];
    if (row.length === sourceRow.length) {
      normalized = [...row];
    } else if (row.length < sourceRow.length) {
      normalized = [...row];
    } else {
      const nonEmpty = row.filter((cell) => cell.trim() !== "");
      if (nonEmpty.length === sourceRow.length) {
        normalized = nonEmpty;
      } else {
        const mapped = positions[rowIndex].map((column) => row[column] ?? "");
        normalized = mapped.length === sourceRow.length ? mapped : [...row];
      }
    }

    return restoreInvariantCells(sourceRow, normalized);
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
