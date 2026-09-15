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
        result.push({
          ordinal: ordinal++,
          blockType: "table",
          sourceType: block.sourceType,
          textKr: text || null,
          rawHtml: raw,
          data: { rows: parseTable(tableHtml) },
        });
        continue;
      }

      if (imageTag) {
        result.push({
          ordinal: ordinal++,
          blockType: "image",
          sourceType: block.sourceType,
          textKr: text || null,
          rawHtml: raw,
          data: {
            src: absoluteUrl(attr(imageTag, "src"), baseUrl),
            alt: attr(imageTag, "alt"),
          },
        });
        continue;
      }

      result.push({
        ordinal: ordinal++,
        blockType: "content",
        sourceType: block.sourceType,
        textKr: text || null,
        rawHtml: raw,
        data: {},
      });
    }
    return result;
  }

  // Fallback for ordinary PLAYNC HTML: preserve headings, tables, images and meaningful paragraphs.
  const pattern = /<(h[1-6]|table|img|p|li)\b[\s\S]*?(?:<\/\1>|\/?>)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    const tagName = match[1].toLowerCase();
    const raw = match[0];
    const text = stripTags(raw);

    if (tagName === "table") {
      result.push({ ordinal: ordinal++, blockType: "table", sourceType: null, textKr: text || null, rawHtml: raw, data: { rows: parseTable(raw) } });
    } else if (tagName === "img") {
      result.push({
        ordinal: ordinal++,
        blockType: "image",
        sourceType: null,
        textKr: attr(raw, "alt"),
        rawHtml: raw,
        data: { src: absoluteUrl(attr(raw, "src"), baseUrl), alt: attr(raw, "alt") },
      });
    } else if (tagName.startsWith("h")) {
      if (text) result.push({ ordinal: ordinal++, blockType: "heading", sourceType: tagName, textKr: text, rawHtml: raw, data: { level: Number(tagName.slice(1)) } });
    } else if (text.length >= 2) {
      result.push({ ordinal: ordinal++, blockType: "text", sourceType: tagName, textKr: text, rawHtml: raw, data: {} });
    }
  }

  return result;
}
