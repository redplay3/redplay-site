import { createHash } from "node:crypto";
import { detectKrSource } from "./sources";
import type { KrIngestProbeResult, KrLinkedPlayncSource } from "./types";

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeEmbeddedMarkup(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\\u003[cC]/g, "<")
    .replace(/\\u003[eE]/g, ">")
    .replace(/\\u002[fF]/g, "/")
    .replace(/\\u003[aA]/g, ":")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
}

function extractTitle(html: string) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og?.[1]) return decodeHtmlEntities(og[1].trim());

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?.[1] ? decodeHtmlEntities(title[1].replace(/\s+/g, " ").trim()) : null;
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length || 0;
}

function extractFeedId(url: string) {
  try {
    const match = new URL(url).pathname.match(/^\/feed\/(\d+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function extractLinkedPlaync(body: string): KrLinkedPlayncSource | null {
  const normalized = normalizeEmbeddedMarkup(body);
  const matches = normalized.match(/https?:\/\/lineage2\.plaync\.com\/[^\s"'<>]+/gi) || [];

  for (const raw of matches) {
    const candidate = raw.replace(/[),.;]+$/, "");
    try {
      const detected = detectKrSource(candidate);
      if (detected.definition.kind === "plaync_dictionary") continue;
      return {
        url: candidate,
        label: detected.definition.label,
        edition: detected.definition.edition,
        articleId: detected.articleId,
      };
    } catch {
      // Not one of the supported PLAYNC content URLs.
    }
  }

  return null;
}

export async function probeKrSource(input: string): Promise<KrIngestProbeResult> {
  const source = detectKrSource(input);
  const requestedUrl = new URL(input).toString();

  try {
    const response = await fetch(requestedUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
        "user-agent": "RedPlay-KR-Ingest/0.1 (+https://redplay.stream)",
      },
    });

    const body = await response.text();
    const normalizedBody = normalizeEmbeddedMarkup(body);
    const contentType = response.headers.get("content-type");
    const looksLikeHtml = contentType?.includes("html") || /<html|<body|<article/i.test(normalizedBody);
    const linkedPlaync = source.definition.kind === "purple_lounge" ? extractLinkedPlaync(body) : null;
    const resolvedEdition = source.definition.edition || linkedPlaync?.edition || null;
    const resolvedArticleId = source.articleId || linkedPlaync?.articleId || null;

    return {
      ok: response.ok && body.length > 0,
      requestedUrl,
      finalUrl: response.url || requestedUrl,
      source,
      feedId: source.definition.kind === "purple_lounge" ? extractFeedId(response.url || requestedUrl) : null,
      resolvedEdition,
      resolvedArticleId,
      linkedPlaync,
      httpStatus: response.status,
      contentType,
      fetchedAt: new Date().toISOString(),
      title: looksLikeHtml ? extractTitle(normalizedBody) : null,
      contentHash: body.length ? createHash("sha256").update(body).digest("hex") : null,
      metrics: {
        bodyChars: body.length,
        tableCount: looksLikeHtml ? countMatches(normalizedBody, /<table\b/gi) : 0,
        imageCount: looksLikeHtml ? countMatches(normalizedBody, /<img\b/gi) : 0,
        headingCount: looksLikeHtml ? countMatches(normalizedBody, /<h[1-6]\b/gi) : 0,
        contentBlockCount: countMatches(normalizedBody, /data-contents-type=/gi),
      },
      ...(response.ok ? {} : { error: `Источник ответил HTTP ${response.status}` }),
    };
  } catch (error) {
    return {
      ok: false,
      requestedUrl,
      finalUrl: requestedUrl,
      source,
      feedId: source.definition.kind === "purple_lounge" ? extractFeedId(requestedUrl) : null,
      resolvedEdition: source.definition.edition,
      resolvedArticleId: source.articleId,
      linkedPlaync: null,
      httpStatus: 0,
      contentType: null,
      fetchedAt: new Date().toISOString(),
      title: null,
      contentHash: null,
      metrics: { bodyChars: 0, tableCount: 0, imageCount: 0, headingCount: 0, contentBlockCount: 0 },
      error: error instanceof Error ? error.message : "Неизвестная ошибка загрузки",
    };
  }
}
