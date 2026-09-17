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
  summary: string | null;
  raw_context: string;
  source_url: string;
  source_date: string | null;
  mode: "short" | "detailed";
  primary: boolean;
  editor_note: string;
};

const composerTool = {
  name: "submitRedPlayTelegramPost",
  description: "Return one ready-to-edit RedPlay Telegram post.",
  parameters: {
    type: "object",
    properties: {
      body: {
        type: "string",
        description: "The full Russian Telegram post, ready for editor review.",
      },
    },
    required: ["body"],
  },
} as const;

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

function normalizeBody(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Некорректный ответ Telegram Composer");
  const body = String((value as Record<string, unknown>).body ?? "").trim();
  if (!body) throw new Error("Telegram Composer не вернул текст поста");
  return body.slice(0, 3900);
}

function referralize(body: string) {
  return body.split(/\r?\n/).map((line) => {
    const plain = line.replace(/\*\*/g, "").replace(/^\s+|\s+$/g, "");
    if (/^⚔️\s*MAIN\b/i.test(plain)) return `**[⚔️ MAIN](${REFERRALS.main})**`;
    if (/^👾\s*ESSENCE\b/i.test(plain)) return `**[👾 ESSENCE](${REFERRALS.essence})**`;
    if (/^🛡\s*(SPECIAL|SPECIAL PROJECT)\b/i.test(plain)) return `**[🛡 SPECIAL PROJECT](${REFERRALS.special})**`;
    return line;
  }).join("\n");
}

function cleanFallbackText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/💜\s*Играть.*$/i, "")
    .trim();
}

function fallbackText(material: Material) {
  const summary = cleanFallbackText(material.summary || "");
  if (summary) return material.mode === "detailed" ? summary.slice(0, 520) : summary.slice(0, 240);

  // raw_context may contain several neighboring announcements. Use it only when
  // the selected title is clearly present; otherwise keep the fallback factual.
  const context = cleanFallbackText(material.raw_context || "");
  if (context && context.toLowerCase().includes(material.title.toLowerCase().replace(/^\[[^\]]+]\s*/, ""))) {
    return material.mode === "detailed" ? context.slice(0, 520) : context.slice(0, 240);
  }
  return "";
}

function fallbackPost(materials: Material[]) {
  const ordered = [...materials].sort((a, b) => Number(b.primary) - Number(a.primary) || a.order - b.order);
  const groups: Array<{ editions: string[]; heading: string }> = [
    { editions: ["main"], heading: "⚔️ MAIN" },
    { editions: ["essence"], heading: "👾 ESSENCE" },
    { editions: ["special"], heading: "🛡 SPECIAL PROJECT" },
    { editions: ["essence_special", "all", "unknown"], heading: "👾 ESSENCE + 🛡 SPECIAL PROJECT" },
  ];
  const dateLabel = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Kyiv", day: "numeric", month: "long" }).format(new Date());
  const lines: string[] = [`🔥 **Что нового в Lineage 2 – ${dateLabel}**`];

  for (const group of groups) {
    const items = ordered.filter((item) => group.editions.includes(item.edition));
    if (!items.length) continue;
    lines.push("", group.heading, "");
    for (const item of items) {
      lines.push(`${item.primary ? "🔥" : "•"} **${item.title}**`);
      const description = fallbackText(item);
      if (description) lines.push(description);
      lines.push(`[Подробнее](${item.source_url})`, "");
    }
  }
  lines.push("RedPlay | Lineage 2");
  return referralize(lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()).slice(0, 3900);
}

function systemPrompt() {
  return `Ты Telegram-редактор RedPlay по Lineage 2. Пользователь УЖЕ выбрал конкретные материалы и сам определил глубину каждого. Не выбирай материалы за него и не добавляй другие новости.

Собери ОДИН готовый русскоязычный Telegram-пост.

Правила:
1. Используй только переданные материалы. Ничего не придумывай и не дополняй фактами из памяти.
2. Если mode=short: максимум 1-2 коротких предложения по материалу.
3. Если mode=detailed: дай содержательный блок, но только по подтверждённым данным; обычно 3-6 предложений или коротких пунктов.
4. primary=true означает главную новость: поставь её первой и дай ей сильнее вводный акцент. Главная новость может быть только одна.
5. editor_note — внутренняя подсказка редактора. Учти её смысл, но не цитируй как служебную заметку.
6. raw_context может содержать несколько событий из одного Telegram-поста. Для каждого объекта ориентируйся прежде всего на его title и source_url. Не приписывай выбранному событию детали соседних событий.
7. Разделяй материалы по версиям. Используй заголовки строго: ⚔️ MAIN, 👾 ESSENCE, 🛡 SPECIAL PROJECT. Не вставляй реферальные URL — сервер добавит их сам.
8. Для конкретного материала можно добавить строку [Подробнее](source_url), если ссылка реально помогает читателю. Не делай голую простыню URL.
9. Стиль RedPlay: живо, конкретно, без официальной воды и без чрезмерного количества эмодзи.
10. Не повторяй одно и то же разными словами. Не пиши про профилактику, мерч или рекорды, если редактор сам их не выбрал.
11. Общий объём обычно 700-2200 знаков, но при нескольких detailed-материалах можно больше, максимум 3800 знаков.
12. Не отвечай обычным текстом. Вызови submitRedPlayTelegramPost ровно один раз.`;
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
    if (item?.id) unique.set(String(item.id), {
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
      id: row.id,
      edition: row.edition,
      category: row.category,
      title: row.title,
      summary: row.summary,
      raw_context: row.raw_context.slice(0, 5000),
      source_url: row.source_url,
      source_date: row.published_at || row.first_seen_at,
      mode: selection.mode,
      primary: Boolean(selection.primary),
      editor_note: selection.note || "",
    };
  });

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.L2_TELEGRAM_MODEL || process.env.KR_TELEGRAM_MODEL || DEFAULT_MODEL;

  let body = "";
  let fallbackReason: string | null = null;

  if (!accountId || !apiToken) {
    fallbackReason = "Cloudflare Workers AI не настроен";
  } else {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt() },
            { role: "user", content: JSON.stringify({ materials }) },
          ],
          tools: [composerTool],
          tool_choice: "required",
          chat_template_kwargs: { enable_thinking: false },
          max_tokens: 1800,
          temperature: 0.18,
        }),
        signal: AbortSignal.timeout(50_000),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        fallbackReason = cloudflareError(payload, response.status);
      } else {
        try {
          const output = cloudflareOutput(payload);
          if (!output) throw new Error("Cloudflare не вернул результат Composer");
          body = referralize(normalizeBody(output));
        } catch (error) {
          fallbackReason = error instanceof Error ? error.message : "Не удалось разобрать ответ Composer";
        }
      }
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      fallbackReason = timedOut
        ? "Composer не успел ответить за 50 секунд"
        : `Cloudflare Workers AI недоступен: ${error instanceof Error ? error.message : "неизвестная ошибка"}`;
    }
  }

  if (!body) body = fallbackPost(materials);
  if (!body) return NextResponse.json({ error: fallbackReason || "Не удалось сформировать пост" }, { status: 502 });

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

  return NextResponse.json({ ok: true, body, digest, fallback: Boolean(fallbackReason), warning: fallbackReason });
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
