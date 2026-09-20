import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const PLAYNC_ROOT = "https://lineage2.plaync.com/board";
const FRESH_WINDOW_MS = 72 * 60 * 60 * 1000;
const COOLDOWN_MS = 8 * 60 * 1000;
const RADAR_SECRET_SHA256 = "0efd016c88874503484bb20ed4d430dc99047b3d1d126f93b11ce65177eb9977";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

const SOURCES = [
  { alias: "l2update", edition: "essence", sourceKind: "plaync_update", apiService: "lin2" },
  { alias: "l2notice", edition: "essence", sourceKind: "plaync_notice", apiService: "lin2" },
  { alias: "l2note", edition: "essence", sourceKind: "plaync_note", apiService: "lin2" },
  { alias: "l2awknupdate", edition: "main", sourceKind: "plaync_update", apiService: "lin2_awkn" },
  { alias: "l2awknnotice", edition: "main", sourceKind: "plaync_notice", apiService: "lin2_awkn" },
  { alias: "l2awknnote", edition: "main", sourceKind: "plaync_note", apiService: "lin2_awkn" },
] as const;

type CommunityArticle = {
  id?: string;
  title?: string;
  statusCode?: number;
  visibilityCode?: number;
  timestamps?: { postedAt?: string; updatedAt?: string };
};

function articleTime(article: CommunityArticle) {
  const value = article.timestamps?.updatedAt || article.timestamps?.postedAt;
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : 0;
}

Deno.serve(async (request) => {
  const providedSecret = request.headers.get("x-redplay-radar-key") || "";
  const providedHash = providedSecret ? await sha256(providedSecret) : "";
  if (!providedSecret || !constantTimeEqual(providedHash, RADAR_SECRET_SHA256)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "supabase_env_missing" }), { status: 500, headers: { "content-type": "application/json" } });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();

  const { data: lastRun } = await supabase
    .from("kr_radar_runs")
    .select("checked_at")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastRun?.checked_at) {
    const elapsed = now.getTime() - Date.parse(lastRun.checked_at);
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < COOLDOWN_MS) {
      return new Response(JSON.stringify({ ok: true, skipped: "cooldown", checkedAt: now.toISOString(), nextInMs: COOLDOWN_MS - elapsed }), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
  }

  const sourceResults: Array<Record<string, unknown>> = [];
  let discoveredCount = 0;
  let newCount = 0;
  let queuedCount = 0;

  for (const source of SOURCES) {
    try {
      const apiUrl = `https://api-community.plaync.com/${source.apiService}/board/${source.alias}/article`;
      const response = await fetch(apiUrl, {
        cache: "no-store",
        headers: {
          accept: "application/json",
          "accept-language": "ko-KR,ko;q=0.9,en;q=0.6",
          "user-agent": "RedPlay-KR-Radar/1.2 (+https://redplay.stream)",
        },
      });
      if (!response.ok) {
        sourceResults.push({ alias: source.alias, edition: source.edition, ok: false, httpStatus: response.status });
        continue;
      }

      const payload = await response.json() as { contentList?: CommunityArticle[] };
      const articles = (Array.isArray(payload.contentList) ? payload.contentList : [])
        .filter((article) => article?.id && article?.title && article.statusCode !== 0 && article.visibilityCode !== 0)
        .slice(0, 20);
      discoveredCount += articles.length;

      const sourceKeys = articles.map((article) => `plaync:${article.id}`);
      const { data: anySeen, error: anySeenError } = await supabase
        .from("kr_radar_seen")
        .select("source_key")
        .eq("source_alias", source.alias)
        .limit(1);
      if (anySeenError) throw new Error(anySeenError.message);
      const firstBaseline = !anySeen?.length;

      const { data: seenRows, error: seenError } = sourceKeys.length
        ? await supabase.from("kr_radar_seen").select("source_key,queued").in("source_key", sourceKeys)
        : { data: [], error: null };
      if (seenError) throw new Error(seenError.message);
      const seen = new Map((seenRows || []).map((row) => [String(row.source_key), Boolean(row.queued)]));

      const unseen = articles.filter((article) => !seen.has(`plaync:${article.id}`));
      newCount += unseen.length;
      const freshCutoff = now.getTime() - FRESH_WINDOW_MS;
      const queueCandidates = firstBaseline ? unseen.filter((article) => articleTime(article) >= freshCutoff) : unseen;
      const queueKeys = queueCandidates.map((article) => `plaync:${article.id}`);

      const { data: existingInbox, error: existingInboxError } = queueKeys.length
        ? await supabase.from("kr_ingest_items").select("source_key").in("source_key", queueKeys)
        : { data: [], error: null };
      if (existingInboxError) throw new Error(existingInboxError.message);
      const inboxKeys = new Set((existingInbox || []).map((row) => String(row.source_key)));

      const inboxRows = queueCandidates
        .filter((article) => !inboxKeys.has(`plaync:${article.id}`))
        .map((article) => {
          const articleId = String(article.id);
          const officialUrl = `${PLAYNC_ROOT}/${source.alias}/view?articleId=${articleId}`;
          return {
            source_key: `plaync:${articleId}`,
            edition: source.edition,
            source_kind: source.sourceKind,
            primary_url: officialUrl,
            plaync_url: officialUrl,
            article_id: articleId,
            feed_id: null,
            title_kr: String(article.title || ""),
            status: "new",
            latest_snapshot_version: 0,
          };
        });
      if (inboxRows.length) {
        const { error: insertInboxError } = await supabase.from("kr_ingest_items").insert(inboxRows);
        if (insertInboxError) throw new Error(insertInboxError.message);
      }
      queuedCount += queueCandidates.length;

      if (unseen.length) {
        const seenInsertRows = unseen.map((article) => {
          const key = `plaync:${article.id}`;
          return {
            source_key: key,
            source_alias: source.alias,
            edition: source.edition,
            article_id: String(article.id),
            title_kr: String(article.title || ""),
            remote_posted_at: article.timestamps?.postedAt || null,
            remote_updated_at: article.timestamps?.updatedAt || null,
            first_seen_at: now.toISOString(),
            last_seen_at: now.toISOString(),
            queued: queueKeys.includes(key),
          };
        });
        const { error: seenInsertError } = await supabase.from("kr_radar_seen").insert(seenInsertRows);
        if (seenInsertError) throw new Error(seenInsertError.message);
      }

      if (seenRows?.length) {
        const existingKeys = seenRows.map((row) => String(row.source_key));
        await supabase.from("kr_radar_seen").update({ last_seen_at: now.toISOString() }).in("source_key", existingKeys);
      }

      sourceResults.push({
        alias: source.alias,
        edition: source.edition,
        ok: true,
        baseline: firstBaseline,
        discovered: articles.length,
        unseen: unseen.length,
        queued: queueCandidates.length,
        insertedInbox: inboxRows.length,
        newest: articles[0] ? { id: articles[0].id, title: articles[0].title, postedAt: articles[0].timestamps?.postedAt || null, updatedAt: articles[0].timestamps?.updatedAt || null } : null,
      });
    } catch (error) {
      sourceResults.push({ alias: source.alias, edition: source.edition, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const ok = sourceResults.every((result) => result.ok !== false);
  await supabase.from("kr_radar_runs").insert({
    checked_at: now.toISOString(), ok, discovered_count: discoveredCount, new_count: newCount, queued_count: queuedCount, details: sourceResults,
  });

  return new Response(JSON.stringify({ ok, checkedAt: now.toISOString(), discoveredCount, newCount, queuedCount, sources: sourceResults }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
});

