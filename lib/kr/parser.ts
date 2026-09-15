export type KrNumericToken = {
  raw: string;
  normalized: string;
  kind: "percent" | "number";
};

export type KrParsedBlock = {
  ordinal: number;
  blockType: "heading" | "text" | "table" | "image" | "content";
  sourceType: string | null;
  textKr: string | null;
  rawHtml: string | null;
  data: Record<string, unknown>;
};

type TableCell = {
  text: string;
  colspan: number;
  rowspan: number;
  header: boolean;
};

type Range = { start: number; end: number };
type LocatedBlock = { index: number; block: Omit<KrParsedBlock, "ordinal"> };

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;|&#xa0;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function normalizeKrMarkup(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\\u003[cC]/g, "<")
    .replace(/\\u003[eE]/g, ">")
    .replace(/\\u002[fF]/g, "/")
    .replace(/\\u003[aA]/g, ":")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
}

function stripTags(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n")
      .replace(/<\/li\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return match?.[1] || null;
}

function intAttr(tag: string, name: string) {
  const value = attr(tag, name);
  const parsed = value ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function absoluteUrl(value: string | null, baseUrl: string) {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function normalizeNumber(raw: string) {
  const percent = raw.endsWith("%");
  const value = raw.replace(/%$/, "").replace(/[\s,]/g, "").replace(/^\+/, "");
  return percent ? `${value}%` : value;
}

export function extractNumericTokens(value: string | null | undefined): KrNumericToken[] {
  if (!value) return [];
  const matches = value.match(/[+-]?(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:\.\d+)?%?/g) || [];
  return matches.map((raw) => ({
    raw,
    normalized: normalizeNumber(raw),
    kind: raw.endsWith("%") ? "percent" : "number",
  }));
}

function numericData(text: string | null) {
  const numericTokens = extractNumericTokens(text);
  return { numericTokens, numericCount: numericTokens.length };
}

function parseTable(rawHtml: string) {
  const rows: TableCell[][] = [];
  const rowMatches = rawHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  for (const row of rowMatches) {
    const cells: TableCell[] = [];
    const cellPattern = /<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(row))) {
      const text = stripTags(cellMatch[3]);
      cells.push({
        text,
        colspan: intAttr(cellMatch[2], "colspan"),
        rowspan: intAttr(cellMatch[2], "rowspan"),
        header: cellMatch[1].toLowerCase() === "th" || /background-color\s*:\s*black/i.test(cellMatch[2]),
      });
    }
    if (cells.some((cell) => cell.text)) rows.push(cells);
  }
  return rows;
}

function findBalancedDivEnd(body: string, start: number) {
  const token = /<\/?div\b[^>]*>/gi;
  token.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(body))) {
    if (/^<\/div/i.test(match[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return token.lastIndex;
  }
  return body.length;
}

function insideRanges(index: number, ranges: Range[]) {
  return ranges.some((range) => index >= range.start && index < range.end);
}

function headingLike(raw: string, text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (/^\[[^\]\n]{1,100}\]$/.test(compact)) return true;

  const sizeMatches = [...raw.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)];
  const maxSize = sizeMatches.reduce((max, match) => Math.max(max, Number(match[1]) || 0), 0);
  if (maxSize >= 20 && compact.length <= 160) return true;

  if (/<(?:strong|b)\b/i.test(raw) && compact.length <= 100 && !/^[-※*]/.test(compact)) return true;
  return false;
}

function collectOrdinaryPlaync(body: string, baseUrl: string) {
  const located: LocatedBlock[] = [];
  const collect = (pattern: RegExp, map: (match: RegExpExecArray) => Omit<KrParsedBlock, "ordinal">) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body))) located.push({ index: match.index, block: map(match) });
  };

  collect(/<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>/gi, (match) => {
    const text = stripTags(match[0]) || null;
    return { blockType: "heading", sourceType: `h${match[1]}`, textKr: text, rawHtml: match[0], data: { level: Number(match[1]), ...numericData(text) } };
  });
  collect(/<table\b[\s\S]*?<\/table>/gi, (match) => {
    const rows = parseTable(match[0]);
    const text = rows.flat().map((cell) => cell.text).filter(Boolean).join("\n") || stripTags(match[0]) || null;
    return { blockType: "table", sourceType: "table", textKr: text, rawHtml: match[0], data: { rows, ...numericData(text) } };
  });
  collect(/<img\b[^>]*>/gi, (match) => {
    const alt = attr(match[0], "alt");
    return { blockType: "image", sourceType: "img", textKr: alt, rawHtml: match[0], data: { src: absoluteUrl(attr(match[0], "src"), baseUrl), alt, ...numericData(alt) } };
  });
  collect(/<(p|li)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const text = stripTags(match[0]) || null;
    return { blockType: "text", sourceType: match[1].toLowerCase(), textKr: text, rawHtml: match[0], data: numericData(text) };
  });

  return located.filter((entry) => entry.block.blockType === "image" || Boolean(entry.block.textKr));
}

export function parseKrSnapshotBody(rawBody: string, baseUrl: string): KrParsedBlock[] {
  const body = normalizeKrMarkup(rawBody);
  const located: LocatedBlock[] = [];

  // Purple Lounge puts data-contents-type=text inside table cells. Treat each tableWrapper
  // as ONE table block first and ignore all nested cell text markers afterwards.
  const tableRanges: Range[] = [];
  const tableWrapper = /<div\b[^>]*class=["'][^"']*\btableWrapper\b[^"']*["'][^>]*>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableWrapper.exec(body))) {
    const start = tableMatch.index;
    const end = findBalancedDivEnd(body, start);
    const raw = body.slice(start, end);
    const tableHtml = raw.match(/<table\b[\s\S]*?<\/table>/i)?.[0] || raw;
    const rows = parseTable(tableHtml);
    const text = rows.flat().map((cell) => cell.text).filter(Boolean).join("\n") || stripTags(tableHtml) || null;
    tableRanges.push({ start, end });
    if (text || rows.length) {
      located.push({
        index: start,
        block: {
          blockType: "table",
          sourceType: "tableWrapper",
          textKr: text,
          rawHtml: raw,
          data: { rows, ...numericData(text) },
        },
      });
    }
    tableWrapper.lastIndex = end;
  }

  const contentPattern = /<div\b[^>]*data-contents-type=["']([^"']+)["'][^>]*>([\s\S]*?)<\/div>/gi;
  let contentMatch: RegExpExecArray | null;
  while ((contentMatch = contentPattern.exec(body))) {
    if (insideRanges(contentMatch.index, tableRanges)) continue;

    const sourceType = contentMatch[1];
    const raw = contentMatch[0];
    const text = stripTags(raw);
    const imageTag = raw.match(/<img\b[^>]*>/i)?.[0] || null;

    if (imageTag) {
      const src = absoluteUrl(attr(imageTag, "src"), baseUrl);
      if (src || text) {
        located.push({
          index: contentMatch.index,
          block: {
            blockType: "image",
            sourceType,
            textKr: text || attr(imageTag, "alt"),
            rawHtml: raw,
            data: { src, alt: attr(imageTag, "alt"), ...numericData(text || attr(imageTag, "alt")) },
          },
        });
      }
      continue;
    }

    if (!text) continue;
    const isHeading = headingLike(raw, text);
    located.push({
      index: contentMatch.index,
      block: {
        blockType: isHeading ? "heading" : "text",
        sourceType,
        textKr: text,
        rawHtml: raw,
        data: { ...(isHeading ? { level: 2 } : {}), ...numericData(text) },
      },
    });
  }

  // If the page has no Lounge content markers, fall back to ordinary PLAYNC HTML parsing.
  if (!located.length) located.push(...collectOrdinaryPlaync(body, baseUrl));

  located.sort((a, b) => a.index - b.index);

  // Remove nested/duplicate fragments while preserving source order.
  const deduped: LocatedBlock[] = [];
  const seen = new Set<string>();
  for (const entry of located) {
    const key = `${entry.block.blockType}|${entry.block.textKr || ""}|${entry.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  return deduped.map((entry, ordinal) => ({ ordinal, ...entry.block }));
}
