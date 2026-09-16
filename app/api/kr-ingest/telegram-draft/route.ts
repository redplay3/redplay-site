import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_MODEL = "@cf/google/gemma-4-26b-a4b-it";

export const maxDuration = 60;

type TelegramDraftAi = {
  recommend_publish: boolean;
  priority: "high" | "medium" | "low";
  reason: string;
  title: string;
  body: string;
};

type AdaptationRow = {
  section_index: number;
  title_ru: string;
  content: {
    units?: Array<{
      type?: string;
      paragraphs_ru?: string[];
      rows_ru?: string[][];
      caption_ru?: string;
    }>;
    validation?: { structure_status?: string };
  } | null;
  numeric_status: string;
};

function parseJsonText(value: string): unknown {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    throw new Error("Модель не вернула валидный JSON");
  }
}

function cloudflareOutput(payload: unknown): unknown | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const result = root.result;
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  if (record.response && typeof record.response === "object") return record.response;
  if (typeof record.response === "string") return parseJsonText(record.response);
  if (Array.isArray(record.choices)) {
    const first = record.choices[0];
    if (first && typeof first === "object") {
      const message = (first as Record<string, unknown>).message;
      if (message && typeof message === "object") {
        const content = (message as Record<string, unknown>).content;
        if (typeof content === "string") return parseJsonText(content);
      }
    }
  }
  return null;
}

function cloudflareError(payload: unknown, status: number) {
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    if (Array.isArray(root.errors) && root.errors.length) {
      const first = root.errors[0];
      if (first && typeof first === "object" && typeof (first as Record<string, unknown>).message === "string") {
        return String((first as Record<string, unknown>).message);
      }
    }
  }
  return `Cloudflare Workers AI HTTP ${status}`;
}

function usageFromCloudflare(payload: unknown) {
  if (!payload || typeof payload !== "object") return { inputTokens: null as number | null, outputTokens: null as number | null };
  const root = payload as Record<string, unknown>;
  const result = root.result && typeof root.result === "object" ? root.result as Record<string, unknown> : {};
  const usage = result.usage && typeof result.usage === "object"
    ? result.usage as Record<string, unknown>
    : root.usage && typeof root.usage === "object" ? root.usage as Record<string, unknown> : {};
  return {
    inputTokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : typeof usage.input_tokens === "number" ? usage.input_tokens : null,
    outputTokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : typeof usage.output_tokens === "number" ? usage.output_tokens : null,
  };
}

function normalizeAi(value: unknown): TelegramDraftAi {
  if (!value || typeof value !== "object") throw new Error("Некорректный ответ Telegram Composer");
  const root = value as Record<string, unknown>;
  const priority = root.priority === "high" || root.priority === "low" ? root.priority : "medium";
  const title = String(root.title ?? "").trim();
  const body = String(root.body ?? "").trim();
  if (!title || !body) throw new Error("Telegram Composer не вернул title/body");
  return {
    recommend_publish: Boolean(root.recommend_publish),
    priority,
    reason: String(root.reason ?? "").trim(),
    title,
    body: body.slice(0, 1800),
  };
}

function adaptationText(row: AdaptationRow) {
  const parts: string[] = [row.title_ru || ""];
  for (const unit of row.content?.units || []) {
    if (Array.isArray(unit.paragraphs_ru)) parts.push(...unit.paragraphs_ru);
    if (Array.isArray(unit.rows_ru)) {
      for (const tableRow of unit.rows_ru) parts.push(tableRow.join(" | "));
    }
    if (unit.caption_ru) parts.push(unit.caption_ru);
  }
  return parts.filter(Boolean).join("\n");
}

function compactAdaptations(rows: AdaptationRow[]) {
  // Telegram needs a concise editorial overview, not the entire article payload.
  // Keeping all sections but capping each one materially reduces AI latency on huge KR patch notes.
  const maxTotal = 32000;
  const maxPerSection = 3200;
  let total = 0;
  const sections: Array<Record<string, unknown>> = [];
  for (const row of rows.sort((a, b) => a.section_index - b.section_index)) {
    if (total >= maxTotal) break;
    const text = adaptationText(row).slice(0, Math.min(maxPerSection, maxTotal - total));
    total += text.length;
    sections.push({
      index: row.section_index,
      title: row.title_ru,
      numeric_status: row.numeric_status,
      structure_status: row.content?.validation?.structure_status || "unknown",
      text,
    });
  }
  return sections;
}

function systemPrompt(edition: string | null) {
  return `Ты Telegram-редактор RedPlay по Lineage 2 ${edition === "main" ? "Main" : "Essence"}. На входе уже проверенная русская адаптация официальной корейской публикации PLAYNC.

Твоя задача — подготовить ПРЕДЛОЖКУ для редактора Telegram, а не публиковать её автоматически.

Правила:
1. Сначала реши, заслуживает ли материал отдельного поста в игровом Telegram-канале.
2. Высокий приоритет: крупные обновления, классы, навыки, зоны, боссы, важные игровые механики, заметные изменения предметов/экономики.
3. Средний: интересные игровые события, акции или точечные изменения, реально полезные большинству игроков.
4. Низкий и обычно recommend_publish=false: проблемы логина/launcher, техработы, служебные notices, поддержка, мелкие багфиксы без игрового эффекта.
5. Даже если recommend_publish=false, дай короткий аккуратный черновик, чтобы редактор мог сам решить.
6. Пост должен быть КОРОТКИМ: обычно 500–1200 символов, максимум 1400 символов. Один пост, не серия.
7. Заголовок + 4–7 самых важных пунктов. Не перечисляй каждую мелочь и не копируй таблицы.
8. Сохраняй критичные цифры только если они действительно важны для сути изменения. Ничего не придумывай.
9. Убирай приветствия NC, юридические формулировки, техническую воду и повторения.
10. Не добавляй ссылку на RedPlay — сайт вставит её отдельно позже. Не добавляй выдуманный анализ.
11. Ответ только валидный JSON без Markdown-обёртки:
{"recommend_publish":true,"priority":"high|medium|low","reason":"короткая причина для редактора","title":"короткий заголовок","body":"готовый Telegram-текст"}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let input: { itemId?: string; force?: boolean };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  if (!input.itemId) return NextResponse.json({ error: "Нужен itemId" }, { status: 400 });

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return NextResponse.json({ error: "Cloudflare Workers AI не настроен" }, { status: 503 });

  const { data: item, error: itemError } = await supabase
    .from("kr_ingest_items")
    .select("id,edition,primary_url,title_kr,latest_snapshot_version")
    .eq("id", input.itemId)
    .maybeSingle();
  if (itemError || !item) return NextResponse.json({ error: "KR material not found" }, { status: 404 });

  const { data: snapshot } = await supabase
    .from("kr_ingest_snapshots")
    .select("id,version")
    .eq("item_id", item.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!snapshot) return NextResponse.json({ error: "Сначала подготовь оригинал" }, { status: 409 });

  if (!input.force) {
    const { data: existing } = await supabase
      .from("kr_telegram_drafts")
      .select("*")
      .eq("snapshot_id", snapshot.id)
      .maybeSingle();
    if (existing) return NextResponse.json({ draft: existing, reused: true });
  }

  const { data: adaptationRows } = await supabase
    .from("kr_ingest_adaptations")
    .select("section_index,title_ru,content,numeric_status")
    .eq("snapshot_id", snapshot.id)
    .order("section_index", { ascending: true });
  const adaptations = (adaptationRows || []) as AdaptationRow[];
  if (!adaptations.length) return NextResponse.json({ error: "Сначала собери RU-адаптацию статьи" }, { status: 409 });

  const invalid = adaptations.filter((row) => row.numeric_status === "fail" || row.content?.validation?.structure_status === "fail");
  if (invalid.length) return NextResponse.json({ error: `Есть ${invalid.length} раздел(а) с FAIL. Сначала исправь проверку статьи.` }, { status: 409 });

  const model = process.env.KR_TELEGRAM_MODEL || DEFAULT_MODEL;
  const source = {
    source_title_kr: item.title_kr,
    edition: item.edition,
    source_url: item.primary_url,
    sections: compactAdaptations(adaptations),
  };

  let response: Response;
  try {
    response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt(item.edition) },
          { role: "user", content: JSON.stringify(source) },
        ],
        max_tokens: 1200,
        temperature: 0.15,
      }),
      signal: AbortSignal.timeout(50_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "неизвестная ошибка";
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(
      { error: timedOut ? "Telegram Composer не успел ответить за 50 секунд. Попробуй ещё раз." : `Cloudflare Workers AI недоступен: ${message}` },
      { status: timedOut ? 504 : 502 },
    );
  }

  const cfPayload = await response.json().catch(() => null);
  if (!response.ok) return NextResponse.json({ error: cloudflareError(cfPayload, response.status) }, { status: 502 });

  let ai: TelegramDraftAi;
  try {
    const rawOutput = cloudflareOutput(cfPayload);
    if (!rawOutput) return NextResponse.json({ error: "Cloudflare не вернул Telegram draft" }, { status: 502 });
    ai = normalizeAi(rawOutput);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось разобрать ответ Telegram Composer" },
      { status: 502 },
    );
  }

  const usage = usageFromCloudflare(cfPayload);

  const draftRow = {
    item_id: item.id,
    snapshot_id: snapshot.id,
    status: "draft",
    priority: ai.priority,
    recommend_publish: ai.recommend_publish,
    recommendation_reason: ai.reason,
    title: ai.title,
    body: ai.body,
    source_url: item.primary_url,
    model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    char_count: ai.body.length,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error: saveError } = await supabase
    .from("kr_telegram_drafts")
    .upsert(draftRow, { onConflict: "snapshot_id" })
    .select("*")
    .single();
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });
  return NextResponse.json({ draft: saved, reused: false });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let input: { draftId?: string; status?: string };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  if (!input.draftId || !["draft","approved","skipped"].includes(input.status || "")) {
    return NextResponse.json({ error: "Нужны draftId и корректный status" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("kr_telegram_drafts")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.draftId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}
