import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { probeKrSource } from "@/lib/kr/probe";
import { parseKrSnapshotBody, type KrParsedBlock } from "@/lib/kr/parser";

const PARSER_VERSION = "kr-parser/0.3";

function stableSourceKey(result: Awaited<ReturnType<typeof probeKrSource>>) {
  if (result.resolvedArticleId) return `plaync:${result.resolvedArticleId}`;
  if (result.feedId) return `purple:${result.feedId}`;
  return `url:${createHash("sha256").update(result.finalUrl).digest("hex").slice(0, 32)}`;
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length || 0;
}

function bodyMetrics(body: string) {
  return {
    bodyChars: body.length,
    tableCount: countMatches(body, /<table\b/gi),
    imageCount: countMatches(body, /<img\b/gi),
    headingCount: countMatches(body, /<h[1-6]\b/gi),
    contentBlockCount: countMatches(body, /data-contents-type=/gi),
  };
}

async function fetchOriginal(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
      "user-agent": "RedPlay-KR-Ingest/0.4 (+https://redplay.stream)",
    },
  });
  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type"),
    sourceUrl: response.url || url,
    body,
    titleKr: null as string | null,
    fetchedVia: "source-page",
  };
}

async function fetchPlayncArticle(
  probe: Awaited<ReturnType<typeof probeKrSource>>,
) {
  const articleId = probe.resolvedArticleId;
  if (!articleId || !probe.source.definition.kind.startsWith("plaync_")) return null;

  const pageUrl = new URL(probe.finalUrl);
  const alias = pageUrl.pathname.match(/^\/board\/([^/]+)\//)?.[1];
  if (!alias) return null;

  const edition = probe.resolvedEdition || probe.source.definition.edition;
  const apiService = edition === "main" ? "lin2_awkn" : "lin2";
  const apiUrl = `https://api-community.plaync.com/${apiService}/board/${alias}/article/${articleId}`;
  const response = await fetch(apiUrl, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
      "user-agent": "RedPlay-KR-Ingest/0.4 (+https://redplay.stream)",
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      contentType: response.headers.get("content-type"),
      sourceUrl: probe.finalUrl,
      body: "",
      titleKr: null as string | null,
      fetchedVia: "plaync-community-api",
    };
  }

  const payload = await response.json() as Record<string, unknown>;
  const article = payload.article && typeof payload.article === "object"
    ? payload.article as Record<string, unknown>
    : null;
  const content = article?.content && typeof article.content === "object"
    ? article.content as Record<string, unknown>
    : null;
  const contentMeta = article?.contentMeta && typeof article.contentMeta === "object"
    ? article.contentMeta as Record<string, unknown>
    : null;
  const body = typeof content?.content === "string" ? content.content : "";
  const titleKr = typeof contentMeta?.title === "string" ? contentMeta.title : null;

  return {
    ok: response.ok && Boolean(body),
    status: response.status,
    contentType: "text/html; source=plaync-community-api",
    sourceUrl: probe.finalUrl,
    body,
    titleKr,
    fetchedVia: "plaync-community-api",
  };
}

async function fetchSource(probe: Awaited<ReturnType<typeof probeKrSource>>) {
  const plaync = await fetchPlayncArticle(probe);
  if (plaync) return plaync;
  return fetchOriginal(probe.finalUrl);
}

function blockRows(snapshotId: string, blocks: KrParsedBlock[]) {
  return blocks.map((block) => ({
    snapshot_id: snapshotId,
    ordinal: block.ordinal,
    block_type: block.blockType,
    source_type: block.sourceType,
    text_kr: block.textKr,
    raw_html: block.rawHtml,
    data: block.data,
  }));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let payload: { url?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  if (!payload.url) return NextResponse.json({ error: "Укажи URL корейской публикации" }, { status: 400 });

  try {
    const probe = await probeKrSource(payload.url);
    if (!probe.ok) return NextResponse.json({ error: probe.error || "Источник недоступен", probe }, { status: 422 });

    const fetched = await fetchSource(probe);
    if (!fetched.ok || !fetched.body) {
      return NextResponse.json({ error: `Источник ответил HTTP ${fetched.status} или не вернул тело статьи` }, { status: 422 });
    }

    const body = fetched.body;
    const titleKr = fetched.titleKr || probe.title;
    const hash = createHash("sha256").update(body).digest("hex");
    const blocks = parseKrSnapshotBody(body, fetched.sourceUrl);
    const sourceKey = stableSourceKey(probe);

    const { data: existingItem, error: itemLookupError } = await supabase
      .from("kr_ingest_items")
      .select("id,latest_snapshot_version,status")
      .eq("source_key", sourceKey)
      .maybeSingle();

    if (itemLookupError) {
      const migrationMissing = itemLookupError.code === "42P01" || /kr_ingest_items/i.test(itemLookupError.message || "");
      return NextResponse.json({
        error: migrationMissing
          ? "KR Inbox storage ещё не создан в Supabase. Примени миграцию docs/kr-ingest.sql."
          : itemLookupError.message,
      }, { status: 500 });
    }

    let itemId = existingItem?.id as string | undefined;
    let latestVersion = Number(existingItem?.latest_snapshot_version || 0);

    const itemMetadata = {
      source_key: sourceKey,
      edition: probe.resolvedEdition,
      source_kind: probe.source.definition.kind,
      primary_url: probe.requestedUrl,
      plaync_url: probe.linkedPlaync?.url || (probe.source.definition.kind.startsWith("plaync_") ? probe.finalUrl : null),
      article_id: probe.resolvedArticleId,
      feed_id: probe.feedId,
      title_kr: titleKr,
    };

    if (!itemId) {
      const { data: created, error } = await supabase
        .from("kr_ingest_items")
        .insert({ ...itemMetadata, status: "new" })
        .select("id,latest_snapshot_version")
        .single();
      if (error || !created) throw new Error(error?.message || "Не удалось создать KR Inbox item");
      itemId = created.id;
      latestVersion = Number(created.latest_snapshot_version || 0);
    } else {
      const { error } = await supabase.from("kr_ingest_items").update(itemMetadata).eq("id", itemId);
      if (error) throw new Error(error.message);
    }

    if (!itemId) throw new Error("Не удалось определить KR Inbox item");

    const { data: duplicate, error: duplicateError } = await supabase
      .from("kr_ingest_snapshots")
      .select("id,version,parser_version")
      .eq("item_id", itemId)
      .eq("content_hash", hash)
      .maybeSingle();
    if (duplicateError) throw new Error(duplicateError.message);

    const metrics = {
      ...probe.metrics,
      ...bodyMetrics(body),
      parsedBlockCount: blocks.length,
      fetchedVia: fetched.fetchedVia,
    };

    if (duplicate) {
      const needsReparse = duplicate.parser_version !== PARSER_VERSION;
      if (needsReparse) {
        const { error: deleteError } = await supabase.from("kr_ingest_blocks").delete().eq("snapshot_id", duplicate.id);
        if (deleteError) throw new Error(deleteError.message);

        if (blocks.length) {
          const { error: insertError } = await supabase.from("kr_ingest_blocks").insert(blockRows(duplicate.id, blocks));
          if (insertError) throw new Error(insertError.message);
        }

        const { error: snapshotUpdateError } = await supabase
          .from("kr_ingest_snapshots")
          .update({ metrics, parser_version: PARSER_VERSION, title_kr: titleKr })
          .eq("id", duplicate.id);
        if (snapshotUpdateError) throw new Error(snapshotUpdateError.message);
      }

      return NextResponse.json({
        ok: true,
        duplicate: true,
        reparsed: needsReparse,
        itemId,
        snapshotId: duplicate.id,
        version: duplicate.version,
        blockCount: blocks.length,
        contentHash: hash,
        parserVersion: needsReparse ? PARSER_VERSION : duplicate.parser_version,
        fetchedVia: fetched.fetchedVia,
      });
    }

    const nextVersion = latestVersion + 1;
    const { data: snapshot, error: snapshotError } = await supabase
      .from("kr_ingest_snapshots")
      .insert({
        item_id: itemId,
        version: nextVersion,
        source_url: fetched.sourceUrl,
        content_hash: hash,
        fetched_at: new Date().toISOString(),
        http_status: fetched.status,
        content_type: fetched.contentType,
        title_kr: titleKr,
        raw_body: body,
        metrics,
        parser_version: PARSER_VERSION,
      })
      .select("id")
      .single();

    if (snapshotError || !snapshot) throw new Error(snapshotError?.message || "Не удалось сохранить snapshot");

    if (blocks.length) {
      const { error } = await supabase.from("kr_ingest_blocks").insert(blockRows(snapshot.id, blocks));
      if (error) {
        await supabase.from("kr_ingest_snapshots").delete().eq("id", snapshot.id);
        throw new Error(error.message);
      }
    }

    const { error: updateError } = await supabase
      .from("kr_ingest_items")
      .update({ latest_snapshot_version: nextVersion, status: "review", title_kr: titleKr })
      .eq("id", itemId);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      ok: true,
      duplicate: false,
      reparsed: false,
      itemId,
      snapshotId: snapshot.id,
      version: nextVersion,
      blockCount: blocks.length,
      contentHash: hash,
      parserVersion: PARSER_VERSION,
      metrics,
      fetchedVia: fetched.fetchedVia,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось импортировать публикацию" },
      { status: 500 },
    );
  }
}
