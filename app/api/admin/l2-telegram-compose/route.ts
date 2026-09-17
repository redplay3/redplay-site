import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const REFERRALS = {
  main: "https://ru.4game.com/s2s/lineage2_RedPlay",
  essence: "https://4ga.me/3m0Ho3F",
  special: "https://ru.4game.com/s2s/redplay_eva",
} as const;

export const maxDuration = 60;

type ComposeItemInput = {
  id: string;
  mode: "short" | "detailed";
  primary?: boolean;
  note?: string;
};

type FeedRow = {
  id: string;
  edition: string;
  category: string;
  title: string;
  summary: string | null;
  raw_context: string;
  source_url: string;
  published_at: string | null;
  first_seen_at: string;
};

type Material = {
  order: number;
  id: string;
  edition: string;
  category: string;
  title: string;
  sourceUrl: string;
  sourceDate: string | null;
  mode: "short" | "detailed";
  primary: boolean;
  editorNote: string;
  context: string;
};

type AiDescription = { id: string; description: string };

const composerTool = {
  name: "submitRedPlayDescriptions",
  description: "Return concise factual descriptions for the supplied RedPlay Telegram materials.",
  parameters: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            description: { type: "string" },
          },
          required: ["id", "description"],
        },
      },
    },
    required: ["items"],
  },
} as const;

const GROUPS = [
  { key: "main", editions: ["main"], heading: `**[⚔️ MAIN](${REFERRALS.main})**` },
  { key: "essence", editions: ["essence"], heading: `**[👾 ESSENCE](${REFERRALS.essence})**` },
  { key: "special", editions: ["special"], heading: `**[🛡 SPECIAL PROJECT](${REFERRALS.special})**` },
  { key: "essence_special", editions: ["essence_special"], heading: `**[👾 ESSENCE](${REFERRALS.essence}) + [🛡 SPECIAL PROJECT](${REFERRALS.special})**` },
  { key: "all", editions: ["all"], heading: "**🌐 ВСЕ ВЕРСИИ**" },
  { key: "unknown", editions: ["unknown"], heading: "**🌐 LINEAGE 2**" },
] as const;

function kyivDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseJsonText(value: string): unknown {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    throw new Error("Модель не вернула структурированный ответ");
  }
}

function toolArguments(value: unknown): unknown | null {
  if (!Array.isArray(value) || !value.length) return null;
  const first = value[0];
  if (!first || typeof first !== "object") return null;
  const record = first as Record<string, unknown>;
  let args = record.arguments;
  if (args == null && record.function && typeof record.function === "object") {
    args = (record.function as Record<string, unknown>).arguments;
  }
  if (args && typeof args === "object") return args;
  if (typeof args === "string" && args.trim()) return parseJsonText(args);
  return null;
}

function cloudflareOutput(payload: unknown): unknown | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const result = root.result;
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;

  const direct = toolArguments(record.tool_calls);
  if (direct) return direct;
  if (record.response && typeof record.response === "object") return record.response;
  if (typeof record.response === "string" && record.response.trim()) return parseJsonText(record.response);

  if (Array.isArray(record.choices)) {
    const first = record.choices[0];
    if (first && typeof first === "object") {
      const message = (first as Record<string, unknown>).message;
      if (message && typeof message === "object") {
        const messageRecord = message as Record<string, unknown>;
        const fromTool = toolArguments(messageRecord.tool_calls);
        if (fromTool) return fromTool;
        if (typeof messageRecord.content === "string" && messageRecord.content.trim()) {
          return parseJsonText(messageRecord.content);
        }
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

function cleanTitle(value: string) {
  return value
    .replace(/^\s*\[[^\]]+\]\s*/u, "")
    .replace(/^\s*[▫️•]\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanContext(value: string) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^💜\s*Играть/i.test(line) && !/^#/.test(line))
    .join("\n")
    .replace(/\s*🗣\s*Подробнее[^\n]*$/i, "")
    .trim();
}

function isAggregateContext(value: string) {
  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  const itemLines = lines.filter((line) => /^[▫️•]\s*\[[^\]]+\]/u.test(line));
  if (itemLines.length >= 2) return true;
  const taggedLines = lines.filter((line) => /\[(?:Акция|Ивент|Коды?|Событие)[^\]]*\]/i.test(line));
  return taggedLines.length >= 2;
}

function isolatedContext(row: FeedRow) {
  const summary = cleanContext(row.summary || "");
  if (summary && !isAggregateContext(summary)) return summary;

  const raw = cleanContext(row.raw_context || "");
  if (!raw || isAggregateContext(raw)) return "";

  const title = cleanTitle(row.title).toLowerCase();
  const rawLower = raw.toLowerCase();
  if (title && rawLower.includes(title)) return raw;
  if (row.title && rawLower.includes(row.title.toLowerCase())) return raw;
  return "";
}

function truncateAtWord(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sliced = clean.slice(0, max + 1);
  const cut = sliced.lastIndexOf(" ");
  return `${(cut > max * 0.65 ? sliced.slice(0, cut) : sliced.slice(0, max)).trim()}…`;
}

function sanitizeDescription(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/\[[^\]]+\]\([^\)]+\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s*Подробнее\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function editionLabel(edition: string) {
  if (edition === "main") return "Main";
  if (edition === "essence") return "Essence";
  if (edition === "special") return "Special Project";
  if (edition === "essence_special") return "Essence и Special Project";
  if (edition === "all") return "всех версий Lineage 2";
  return "Lineage 2";
}

function genericDescription(material: Material) {
  const version = editionLabel(material.edition);
  if (material.category === "promo") return `Акция для ${version}.`;
  if (material.category === "code") return `Код для ${version}.`;
  if (material.category === "event") return `Игровое событие для ${version}.`;
  if (material.category === "update") return `Обновление для ${version}.`;
  if (material.category === "notice") return `Важная информация для ${version}.`;
  if (material.category === "maintenance") return `Информация о профилактических работах для ${version}.`;
  return `Материал для ${version}.`;
}

function categoryIcon(category: string) {
  if (category === "promo") return "🎁";
  if (category === "event") return "🎯";
  if (category === "code") return "🎟️";
  if (category === "update") return "⚡";
  if (category === "notice") return "📌";
  if (category === "maintenance") return "🛠️";
  return "•";
}

function normalizeAiDescriptions(value: unknown, allowedIds: Set<string>) {
  const result = new Map<string, string>();
  if (!value || typeof value !== "object") return result;
  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items)) return result;

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = String(row.id || "").trim();
    if (!id || !allowedIds.has(id)) continue;
    const description = sanitizeDescription(String(row.description || ""));
    if (description) result.set(id, description);
  }
  return result;
}

function systemPrompt() {
  return `Ты готовишь только КОРОТКИЕ ОПИСАНИЯ выбранных материалов для Telegram-редактора RedPlay по Lineage 2.

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Для каждого входного material верни ровно одну запись с тем же id.
2. Пиши только описание. НЕ пиши заголовок материала, название версии, ссылки, Markdown, эмодзи или слово «Подробнее».
3. Используй ТОЛЬКО поле context и editor_note. Не добавляй факты из памяти.
4. Если context пустой или не содержит конкретных фактов именно об этом событии — верни пустую строку description. Сервер сам сделает безопасную подпись.
5. Не переносить сведения из соседних акций/ивентов. Один material = одно событие.
6. short: 1 короткое предложение. detailed: до 3 коротких предложений, только если context реально содержит достаточно фактов.
7. Сохраняй важные даты, цифры и награды, если они прямо есть в context.
8. editor_note — только редакторский акцент; он не является новым фактом.
9. Вызови submitRedPlayDescriptions ровно один раз.`;
}

function materialDescription(material: Material, ai: Map<string, string>, max: number) {
  const fromAi = ai.get(material.id);
  if (material.context && fromAi) return truncateAtWord(fromAi, max);
  if (material.context) return truncateAtWord(sanitizeDescription(material.context), max);
  return genericDescription(material);
}

function buildPost(materials: Material[], ai: Map<string, string>) {
  const primary = materials.find((item) => item.primary) || null;
  const primaryGroup = primary ? GROUPS.find((group) => group.editions.includes(primary.edition as never))?.key : null;
  const groups = primaryGroup
    ? [...GROUPS].sort((a, b) => Number(b.key === primaryGroup) - Number(a.key === primaryGroup))
    : [...GROUPS];

  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const lines: string[] = [`🔥 **Что нового в Lineage 2 – ${dateLabel}**`];
  const perDescription = Math.max(140, Math.min(480, Math.floor(2400 / Math.max(1, materials.length))));

  for (const group of groups) {
    const groupItems = materials
      .filter((item) => group.editions.includes(item.edition as never))
      .sort((a, b) => Number(b.primary) - Number(a.primary) || a.order - b.order);
    if (!groupItems.length) continue;

    lines.push("", group.heading, "");
    for (const item of groupItems) {
      const title = cleanTitle(item.title) || "Lineage 2";
      lines.push(`${item.primary ? "🔥" : categoryIcon(item.category)} **${title}**`);
      const max = item.mode === "detailed" ? perDescription : Math.min(220, perDescription);
      const description = materialDescription(item, ai, max);
      if (description) lines.push(description);
      lines.push(`[Подробнее](${item.sourceUrl})`, "");
    }
  }

  lines.push("**RedPlay | Lineage 2**");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase не настроен" }, { status: 503 }), supabase: null };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: NextResponse.json({ error: "Нужна авторизация" }, { status: 401 }), supabase: null };
  const { data: allowed, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || !allowed) return { error: NextResponse.json({ error: "Нет доступа" }, { status: 403 }), supabase: null };
  return { error: null, supabase };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase) return auth.error;
  const supabase = auth.supabase;

  let input: { items?: ComposeItemInput[] };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const requested = Array.isArray(input.items) ? input.items : [];
  if (!requested.length) return NextResponse.json({ error: "Выбери хотя бы один материал" }, { status: 400 });
  if (requested.length > 12) return NextResponse.json({ error: "За один раз можно собрать максимум 12 материалов" }, { status: 400 });

  const unique = new Map<string, ComposeItemInput>();
  requested.forEach((item) => {
    if (!item?.id) return;
    unique.set(String(item.id), {
      id: String(item.id),
      mode: item.mode === "detailed" ? "detailed" : "short",
      primary: Boolean(item.primary),
      note: String(item.note || "").trim().slice(0, 500),
    });
  });
  const selections = [...unique.values()];
  if (!selections.length) return NextResponse.json({ error: "Не удалось прочитать выбранные материалы" }, { status: 400 });
  if (selections.filter((item) => item.primary).length > 1) return NextResponse.json({ error: "Главной может быть только одна новость" }, { status: 400 });

  const ids = selections.map((item) => item.id);
  const { data: rows, error: feedError } = await supabase
    .from("l2_ru_feed_items")
    .select("id,edition,category,title,summary,raw_context,source_url,published_at,first_seen_at")
    .in("id", ids);
  if (feedError) return NextResponse.json({ error: feedError.message }, { status: 500 });

  const byId = new Map((rows || []).map((row) => [String(row.id), row as FeedRow]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) return NextResponse.json({ error: "Часть выбранных материалов больше не найдена в базе" }, { status: 409 });

  const materials: Material[] = selections.map((selection, index) => {
    const row = byId.get(selection.id)!;
    return {
      order: index + 1,
      id: String(row.id),
      edition: String(row.edition),
      category: String(row.category),
      title: cleanTitle(String(row.title)),
      sourceUrl: String(row.source_url),
      sourceDate: row.published_at || row.first_seen_at,
      mode: selection.mode,
      primary: Boolean(selection.primary),
      editorNote: selection.note || "",
      context: isolatedContext(row),
    };
  });

  const aiDescriptions = new Map<string, string>();
  const aiCandidates = materials.filter((item) => item.context);
  let warning: string | null = null;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.L2_TELEGRAM_MODEL || process.env.KR_TELEGRAM_MODEL || DEFAULT_MODEL;

  if (aiCandidates.length && accountId && apiToken) {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt() },
            {
              role: "user",
              content: JSON.stringify({
                materials: aiCandidates.map((item) => ({
                  id: item.id,
                  title: item.title,
                  edition: item.edition,
                  category: item.category,
                  context: item.context,
                  mode: item.mode,
                  editor_note: item.editorNote,
                })),
              }),
            },
          ],
          tools: [composerTool],
          tool_choice: "required",
          chat_template_kwargs: { enable_thinking: false },
          max_tokens: 1000,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(45_000),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        warning = cloudflareError(payload, response.status);
      } else {
        const output = cloudflareOutput(payload);
        const parsed = normalizeAiDescriptions(output, new Set(aiCandidates.map((item) => item.id)));
        parsed.forEach((description, id) => aiDescriptions.set(id, description));
        if (!parsed.size) warning = "AI не вернул отдельные описания; использована безопасная сборка по источникам";
      }
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      warning = timedOut
        ? "AI не успел ответить; использована безопасная сборка по источникам"
        : `AI недоступен; использована безопасная сборка по источникам`;
    }
  } else if (aiCandidates.length) {
    warning = "AI не настроен; использована безопасная сборка по источникам";
  }

  const body = buildPost(materials, aiDescriptions);
  if (!body) return NextResponse.json({ error: "Не удалось сформировать пост" }, { status: 502 });

  const now = new Date().toISOString();
  const digestDate = kyivDateKey();
  const { data: digest, error: saveError } = await supabase
    .from("l2_ru_telegram_digests")
    .upsert({
      digest_date: digestDate,
      status: "composed",
      body,
      item_ids: ids,
      generated_at: now,
      updated_at: now,
    }, { onConflict: "digest_date" })
    .select("id,digest_date,status,body,item_ids,generated_at,updated_at")
    .single();
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  return NextResponse.json({ ok: true, body, digest, warning, sourceSafe: true });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error || !auth.supabase) return auth.error;
  const supabase = auth.supabase;

  let input: { itemIds?: string[] };
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const itemIds = Array.isArray(input.itemIds) ? [...new Set(input.itemIds.map(String).filter(Boolean))] : [];
  if (!itemIds.length) return NextResponse.json({ error: "Нет материалов для отметки публикации" }, { status: 400 });

  const digestDate = kyivDateKey();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("l2_ru_telegram_digests")
    .update({ status: "published", item_ids: itemIds, updated_at: now })
    .eq("digest_date", digestDate)
    .select("id,status,item_ids,updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Сначала сформируй сегодняшний пост" }, { status: 409 });
  return NextResponse.json({ ok: true, digest: data });
}
