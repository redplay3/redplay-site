import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { probeKrSource } from "@/lib/kr/probe";
import { parseKrSnapshotBody } from "@/lib/kr/parser";

function stableSourceKey(result: Awaited<ReturnType<typeof probeKrSource>>) {
  if (result.resolvedArticleId) return `plaync:${result.resolvedArticleId}`;
  if (result.feedId) return `purple:${result.feedId}`;
  return `url:${createHash("sha256").update(result.finalUrl).digest("hex").slice(0, 32)}`;
}

async function fetchOriginal(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
      "user-agent": "RedPlay-KR-Ingest/0.2 (+https://redplay.stream)",
    },
  });
  const body = await response.text();
  return { response, body };
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

    const { response, body } = await fetchOriginal(probe.finalUrl);
    if (!response.ok || !body) return NextResponse.json({ error: `Источник ответил HTTP ${response.status}` }, { status: 422 });

    const hash = createHash("sha256").update(body).digest("hex");
    const blocks = parseKrSnapshotBody(body, response.url || probe.finalUrl);
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
      title_kr: probe.title,
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

    const { data: duplicate, error: duplicateError } = await supabase
      .from("kr_ingest_snapshots")
      .select("id,version")
      .eq("item_id", itemId)
      .eq("content_hash", hash)
      .maybeSingle();
    if (duplicateError) throw new Error(duplicateError.message);

    if (duplicate) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        itemId,
        snapshotId: duplicate.id,
        version: duplicate.version,
        blockCount: blocks.length,
        contentHash: hash,
      });
    }

    const nextVersion = latestVersion + 1;
    const metrics = { ...probe.metrics, parsedBlockCount: blocks.length };

    const { data: snapshot, error: snapshotError } = await supabase
      .from("kr_ingest_snapshots")
      .insert({
        item_id: itemId,
        version: nextVersion,
        source_url: response.url || probe.finalUrl,
        content_hash: hash,
        fetched_at: new Date().toISOString(),
        http_status: response.status,
        content_type: response.headers.get("content-type"),
        title_kr: probe.title,
        raw_body: body,
        metrics,
        parser_version: "kr-parser/0.1",
      })
      .select("id")
      .single();

    if (snapshotError || !snapshot) throw new Error(snapshotError?.message || "Не удалось сохранить snapshot");

    if (blocks.length) {
      const rows = blocks.map((block) => ({
        snapshot_id: snapshot.id,
        ordinal: block.ordinal,
        block_type: block.blockType,
        source_type: block.sourceType,
        text_kr: block.textKr,
        raw_html: block.rawHtml,
        data: block.data,
      }));
      const { error } = await supabase.from("kr_ingest_blocks").insert(rows);
      if (error) {
        await supabase.from("kr_ingest_snapshots").delete().eq("id", snapshot.id);
        throw new Error(error.message);
      }
    }

    const nextStatus = existingItem?.status === "published" ? "review" : "review";
    const { error: updateError } = await supabase
      .from("kr_ingest_items")
      .update({ latest_snapshot_version: nextVersion, status: nextStatus })
      .eq("id", itemId);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      ok: true,
      duplicate: false,
      itemId,
      snapshotId: snapshot.id,
      version: nextVersion,
      blockCount: blocks.length,
      contentHash: hash,
      metrics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось импортировать публикацию" },
      { status: 500 },
    );
  }
}
