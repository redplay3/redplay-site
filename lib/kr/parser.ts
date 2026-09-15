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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
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
  const rows: string[][] = [];
  const rowMatches = rawHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  for (const row of rowMatches) {
    const cells = row.match(/<(?:th|td)\b[\s\S]*?<\/(?:th|td)>/gi) || [];
    const values = cells.map(stripTags).filter(Boolean);
    if (values.length) rows.push(values);
  }
  return rows;
}

function contentBlockSlices(body: string) {
  const marker = /data-contents-type=["']([^"']+)["']/gi;
  const points: Array<{ index: number; type: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = marker.exec(body))) points.push({ index: match.index, type: match[1] });

  return points.map((point, index) => {
    const start = Math.max(0, body.lastIndexOf("<", point.index));
    const next = points[index + 1]?.index ?? body.length;
    const nextStart = next === body.length ? body.length : Math.max(start, body.lastIndexOf("<", next));
    return { sourceType: point.type, rawHtml: body.slice(start, nextStart) };
  });
}

type LocatedBlock = { index: number; block: Omit<KrParsedBlock, "ordinal"> };

function collect(body: string, pattern: RegExp, map: (match: RegExpExecArray) => Omit<KrParsedBlock, "ordinal">) {
  const found: LocatedBlock[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) found.push({ index: match.index, block: map(match) });
  return found;
}

export function parseKrSnapshotBody(rawBody: string, baseUrl: string): KrParsedBlock[] {
  const body = normalizeKrMarkup(rawBody);
  const result: KrParsedBlock[] = [];
  let ordinal = 0;

  const contentSlices = contentBlockSlices(body);
  if (contentSlices.length) {
    for (const block of contentSlices) {
      const raw = block.rawHtml.trim();
      if (!raw) continue;
      const tableHtml = raw.match(/<table\b[\s\S]*?<\/table>/i)?.[0];
      const imageTag = raw.match(/<img\b[^>]*>/i)?.[0];
      const text = stripTags(raw);

      if (tableHtml) {
        const rows = parseTable(tableHtml);
        const tableText = rows.flat().join("\n") || text || null;
        if (!rows.length && !tableText) continue;
        result.push({
          ordinal: ordinal++,
          blockType: "table",
          sourceType: block.sourceType,
          textKr: tableText,
          rawHtml: raw,
          data: { rows, ...numericData(tableText) },
        });
        continue;
      }

      if (imageTag) {
        const src = absoluteUrl(attr(imageTag, "src"), baseUrl);
        if (!src && !text) continue;
        result.push({
          ordinal: ordinal++,
          blockType: "image",
          sourceType: block.sourceType,
          textKr: text || null,
          rawHtml: raw,
          data: { src, alt: attr(imageTag, "alt"), ...numericData(text || null) },
        });
        continue;
      }

      // Purple Lounge contains technical layout blocks with no visible content.
      if (!text) continue;

      result.push({
        ordinal: ordinal++,
        blockType: "content",
        sourceType: block.sourceType,
        textKr: text,
        rawHtml: raw,
        data: numericData(text),
      });
    }
    return result;
  }

  // Fallback for ordinary PLAYNC HTML. Collect separately, then restore document order.
  const located: LocatedBlock[] = [
    ...collect(body, /<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>/gi, (match) => {
      const text = stripTags(match[0]) || null;
      return {
        blockType: "heading",
        sourceType: `h${match[1]}`,
        textKr: text,
        rawHtml: match[0],
        data: { level: Number(match[1]), ...numericData(text) },
      };
    }),
    ...collect(body, /<table\b[\s\S]*?<\/table>/gi, (match) => {
      const rows = parseTable(match[0]);
      const text = rows.flat().join("\n") || stripTags(match[0]) || null;
      return { blockType: "table", sourceType: "table", textKr: text, rawHtml: match[0], data: { rows, ...numericData(text) } };
    }),
    ...collect(body, /<img\b[^>]*>/gi, (match) => {
      const alt = attr(match[0], "alt");
      return {
        blockType: "image",
        sourceType: "img",
        textKr: alt,
        rawHtml: match[0],
        data: { src: absoluteUrl(attr(match[0], "src"), baseUrl), alt, ...numericData(alt) },
      };
    }),
    ...collect(body, /<(p|li)\b[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
      const text = stripTags(match[0]) || null;
      return { blockType: "text", sourceType: match[1].toLowerCase(), textKr: text, rawHtml: match[0], data: numericData(text) };
    }),
  ].filter((entry) => entry.block.blockType === "image" || Boolean(entry.block.textKr));

  located.sort((a, b) => a.index - b.index);
  for (const entry of located) result.push({ ordinal: ordinal++, ...entry.block });
  return result;
}
