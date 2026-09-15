import { createHash } from "node:crypto";
import { detectKrSource } from "./sources";
import type { KrIngestProbeResult } from "./types";

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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
    const contentType = response.headers.get("content-type");
    const looksLikeHtml = contentType?.includes("html") || /<html|<body|<article/i.test(body);

    return {
      ok: response.ok && body.length > 0,
      requestedUrl,
      finalUrl: response.url || requestedUrl,
      source,
      httpStatus: response.status,
      contentType,
      fetchedAt: new Date().toISOString(),
      title: looksLikeHtml ? extractTitle(body) : null,
      contentHash: body.length ? createHash("sha256").update(body).digest("hex") : null,
      metrics: {
        bodyChars: body.length,
        tableCount: looksLikeHtml ? countMatches(body, /<table\b/gi) : 0,
        imageCount: looksLikeHtml ? countMatches(body, /<img\b/gi) : 0,
        headingCount: looksLikeHtml ? countMatches(body, /<h[1-6]\b/gi) : 0,
      },
      ...(response.ok ? {} : { error: `Источник ответил HTTP ${response.status}` }),
    };
  } catch (error) {
    return {
      ok: false,
      requestedUrl,
      finalUrl: requestedUrl,
      source,
      httpStatus: 0,
      contentType: null,
      fetchedAt: new Date().toISOString(),
      title: null,
      contentHash: null,
      metrics: { bodyChars: 0, tableCount: 0, imageCount: 0, headingCount: 0 },
      error: error instanceof Error ? error.message : "Неизвестная ошибка загрузки",
    };
  }
}
