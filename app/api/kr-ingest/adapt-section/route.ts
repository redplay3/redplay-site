import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractNumericTokens } from "@/lib/kr/parser";
import { assembleSemanticSections, type KrSemanticSection, type KrSemanticSourceBlock } from "@/lib/kr/semantic";

const DEFAULT_MODEL = "@cf/google/gemma-4-26b-a4b-it";

const FREE_MODELS = {
  "@cf/google/gemma-4-26b-a4b-it": { inputNeuronsPerMillion: 9091, outputNeuronsPerMillion: 27273 },
  "@cf/zai-org/glm-4.7-flash": { inputNeuronsPerMillion: 5500, outputNeuronsPerMillion: 36400 },
  "@cf/nvidia/nemotron-3-120b-a12b": { inputNeuronsPerMillion: 45455, outputNeuronsPerMillion: 136364 },
} as const;

type SupportedModel = keyof typeof FREE_MODELS;

type AiUnit = {
  type: "text" | "table" | "image";
  paragraphs_ru: string[];
  rows_ru: string[][];
  caption_ru: string;
};

type AiTerm = {
  kr: string;
  en: string;
  ru: string;
  display: string;
  status: "unverified";
};

type AiAdaptation = {
  title_ru: string;
  units: AiUnit[];
  terms: AiTerm[];
};

function tableRows(block: KrSemanticSourceBlock): string[][] {
  const rows = block.data?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.filter(Array.isArray).map((row) => row.map((cell) => {
    if (cell && typeof cell === "object" && "text" in (cell as Record<string, unknown>)) {
      return String((cell as Record<string, unknown>).text ?? "");
    }
    return String(cell ?? "");
  }));
}

function sourcePayload(section: KrSemanticSection) {
  return {
    section_id: section.id,
    kind: section.kind,
    title_kr: section.titleKr,
    units: section.units.map((unit) => {
      if (unit.type === "text") {
        return {
          type: "text",
          paragraphs_kr: unit.paragraphs,
          rows_kr: [] as string[][],
          image_src: "",
          image_alt_kr: "",
        };
      }
      if (unit.type === "table") {
        return {
          type: "table",
          paragraphs_kr: [] as string[],
          rows_kr: tableRows(unit.block),
          image_src: "",
          image_alt_kr: "",
        };
      }
      return {
        type: "image",
        paragraphs_kr: [] as string[],
        rows_kr: [] as string[][],
        image_src: typeof unit.block.data?.src === "string" ? unit.block.data.src : "",
        image_alt_kr: unit.block.text_kr || "",
      };
    }),
    numeric_tokens: [
      ...extractNumericTokens(section.titleKr || "").map((token) => token.raw),
      ...section.numericTokens.map((token) => token.raw),
    ],
  };
}

function systemInstruction(edition: string | null) {
  return `Ты редактор RedPlay и локализуешь официальный корейский патчноут Lineage 2 ${edition === "main" ? "Main" : "Essence"} на русский язык.

Правила обязательны:
1. Перед тобой один ЦЕЛЫЙ смысловой раздел. Переводи и адаптируй его как единый раздел нормальной статьи, а не как набор разрозненных фрагментов.
2. Нельзя сокращать факты, строки таблиц, условия, ограничения, уровни, проценты, количества или примечания. Не добавляй игровой анализ и новые факты на этом этапе.
3. Сохрани порядок и количество units. type каждого output unit должен совпадать с соответствующим input unit.
4. Для table сохрани ТОЧНО то же количество строк и ячеек в каждой строке. Переводи только текст ячеек.
5. ВСЕ числа, знаки +/-, проценты и диапазоны должны сохранить исходные значения. Не пересчитывай проценты и не добавляй собственные числа.
6. Русский текст должен звучать естественно для игрока Lineage 2, а не как машинный подстрочник.
7. Игровые названия: если корейское имя уверенно восстанавливается как английское название, используй формат English Name (Русское название). Не выдавай предложенный русский вариант за официальную локализацию. Добавь такую сущность в terms со status=unverified.
8. Если английское имя нельзя восстановить уверенно, не выдумывай его: сохрани корейское имя в en и дай осторожный русский вариант в ru/display, status всё равно unverified.
9. Для text заполняй paragraphs_ru, для table – rows_ru, для image – caption_ru. Неиспользуемые поля оставляй пустым массивом или пустой строкой.
10. Ответ должен быть ТОЛЬКО валидным JSON без Markdown и без пояснений вокруг него, строго такой формы:
{"title_ru":"...","units":[{"type":"text|table|image","paragraphs_ru":[],"rows_ru":[],"caption_ru":""}],"terms":[{"kr":"...","en":"...","ru":"...","display":"...","status":"unverified"}]}`;
}

function parseJsonText(value: string): unknown {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    throw new Error("Модель не вернула валидный JSON");
  }
}

function normalizeAdaptation(value: unknown): AiAdaptation {
  if (!value || typeof value !== "object") throw new Error("Некорректная структура адаптации");
  const root = value as Record<string, unknown>;
  if (typeof root.title_ru !== "string" || !Array.isArray(root.units)) {
    throw new Error("В адаптации отсутствует title_ru или units");
  }

  const units: AiUnit[] = root.units.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Unit ${index + 1}: некорректный объект`);
    const unit = entry as Record<string, unknown>;
    const type = unit.type;
    if (type !== "text" && type !== "table" && type !== "image") {
      throw new Error(`Unit ${index + 1}: неизвестный type`);
    }
    const paragraphsRu = Array.isArray(unit.paragraphs_ru)
      ? unit.paragraphs_ru.map((item) => String(item ?? ""))
      : [];
    const rowsRu = Array.isArray(unit.rows_ru)
      ? unit.rows_ru.filter(Array.isArray).map((row) => row.map((cell) => String(cell ?? "")))
      : [];
    return {
      type,
      paragraphs_ru: paragraphsRu,
      rows_ru: rowsRu,
      caption_ru: typeof unit.caption_ru === "string" ? unit.caption_ru : "",
    };
  });

  const terms: AiTerm[] = [];
  if (Array.isArray(root.terms)) {
    for (const entry of root.terms) {
      if (!entry || typeof entry !== "object") continue;
      const term = entry as Record<string, unknown>;
      terms.push({
        kr: String(term.kr ?? ""),
        en: String(term.en ?? ""),
        ru: String(term.ru ?? ""),
        display: String(term.display ?? term.ru ?? ""),
        status: "unverified",
      });
    }
  }

  return { title_ru: root.title_ru, units, terms };
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
  if (!payload || typeof payload !== "object") return `Cloudflare Workers AI HTTP ${status}`;
  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.errors) && root.errors.length) {
    const first = root.errors[0];
    if (first && typeof first === "object") {
      const message = (first as Record<string, unknown>).message;
      if (typeof message === "string") return message;
    }
  }
  return `Cloudflare Workers AI HTTP ${status}`;
}

function usageFromCloudflare(payload: unknown): { inputTokens: number | null; outputTokenCount: number | null } {
  if (!payload || typeof payload !== "object") return { inputTokens: null, outputTokenCount: null };
  const root = payload as Record<string, unknown>;
  const result = root.result && typeof root.result === "object"
    ? root.result as Record<string, unknown>
    : {};
  const usage = result.usage && typeof result.usage === "object"
    ? result.usage as Record<string, unknown>
    : root.usage && typeof root.usage === "object"
      ? root.usage as Record<string, unknown>
      : {};

  const inputTokens = typeof usage.prompt_tokens === "number"
    ? usage.prompt_tokens
    : typeof usage.input_tokens === "number" ? usage.input_tokens : null;
  const outputTokenCount = typeof usage.completion_tokens === "number"
    ? usage.completion_tokens
    : typeof usage.output_tokens === "number" ? usage.output_tokens : null;
  return { inputTokens, outputTokenCount };
}

function estimatedNeurons(model: SupportedModel, inputTokens: number | null, outputTokenCount: number | null) {
  if (inputTokens == null || outputTokenCount == null) return null;
  const rates = FREE_MODELS[model];
  return Math.round(
    (inputTokens / 1_000_000) * rates.inputNeuronsPerMillion
    + (outputTokenCount / 1_000_000) * rates.outputNeuronsPerMillion,
  );
}

function adaptationText(adaptation: AiAdaptation) {
  const parts = [adaptation.title_ru];
  for (const unit of adaptation.units) {
    parts.push(...unit.paragraphs_ru);
    for (const row of unit.rows_ru) parts.push(...row);
    if (unit.caption_ru) parts.push(unit.caption_ru);
  }
  return parts.join("\n");
}

function numericMultiset(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) || 0) + 1);
  return map;
}

function sameNumericMultiset(a: string[], b: string[]) {
  const left = numericMultiset(a);
  const right = numericMultiset(b);
  if (left.size !== right.size) return false;
  for (const [key, count] of left) if (right.get(key) !== count) return false;
  return true;
}

function validateStructure(section: KrSemanticSection, adaptation: AiAdaptation) {
  const issues: string[] = [];
  if (adaptation.units.length !== section.units.length) {
    issues.push(`Ожидалось units: ${section.units.length}, получено: ${adaptation.units.length}`);
  }

  const count = Math.min(section.units.length, adaptation.units.length);
  for (let i = 0; i < count; i += 1) {
    const source = section.units[i];
    const output = adaptation.units[i];
    if (source.type !== output.type) issues.push(`Unit ${i + 1}: ${source.type} → ${output.type}`);
    if (source.type === "table" && output.type === "table") {
      const sourceRows = tableRows(source.block);
      if (sourceRows.length !== output.rows_ru.length) {
        issues.push(`Таблица ${i + 1}: строк ${sourceRows.length} → ${output.rows_ru.length}`);
      }
      const rows = Math.min(sourceRows.length, output.rows_ru.length);
      for (let r = 0; r < rows; r += 1) {
        if (sourceRows[r].length !== output.rows_ru[r].length) {
          issues.push(`Таблица ${i + 1}, строка ${r + 1}: ячеек ${sourceRows[r].length} → ${output.rows_ru[r].length}`);
        }
      }
    }
  }
  return issues;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let payload: { snapshotId?: string; sectionId?: string; model?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  if (!payload.snapshotId || !payload.sectionId) {
    return NextResponse.json({ error: "Нужны snapshotId и sectionId" }, { status: 400 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return NextResponse.json({ error: "В Vercel нужны CLOUDFLARE_ACCOUNT_ID и CLOUDFLARE_API_TOKEN" }, { status: 503 });
  }

  const requestedModel = payload.model || process.env.KR_TRANSLATION_MODEL || DEFAULT_MODEL;
  if (!(requestedModel in FREE_MODELS)) {
    return NextResponse.json({ error: "Эта модель не разрешена для KR Translator" }, { status: 400 });
  }
  const model = requestedModel as SupportedModel;

  try {
    const { data: snapshot, error: snapshotError } = await supabase
      .from("kr_ingest_snapshots")
      .select("id,item_id,version")
      .eq("id", payload.snapshotId)
      .single();
    if (snapshotError || !snapshot) return NextResponse.json({ error: "Snapshot не найден" }, { status: 404 });

    const { data: item } = await supabase
      .from("kr_ingest_items")
      .select("edition,title_kr")
      .eq("id", snapshot.item_id)
      .single();

    const { data: rawBlocks, error: blocksError } = await supabase
      .from("kr_ingest_blocks")
      .select("id,ordinal,block_type,source_type,text_kr,raw_html,data")
      .eq("snapshot_id", snapshot.id)
      .order("ordinal", { ascending: true });
    if (blocksError) throw new Error(blocksError.message);

    const sections = assembleSemanticSections((rawBlocks || []) as KrSemanticSourceBlock[]);
    const sectionIndex = sections.findIndex((section) => section.id === payload.sectionId);
    if (sectionIndex < 0) return NextResponse.json({ error: "Смысловой раздел не найден" }, { status: 404 });
    const section = sections[sectionIndex];

    const inferenceInput: Record<string, unknown> = {
      messages: [
        { role: "system", content: systemInstruction(item?.edition || null) },
        { role: "user", content: JSON.stringify(sourcePayload(section)) },
      ],
      temperature: 0.15,
      max_tokens: 16000,
      stream: false,
    };
    if (model === "@cf/google/gemma-4-26b-a4b-it") {
      inferenceInput.chat_template_kwargs = { enable_thinking: false };
    }

    const cloudflareResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(inferenceInput),
      },
    );

    const cloudflarePayload = await cloudflareResponse.json() as Record<string, unknown>;
    if (!cloudflareResponse.ok || cloudflarePayload.success === false) {
      throw new Error(cloudflareError(cloudflarePayload, cloudflareResponse.status));
    }

    const rawAdaptation = cloudflareOutput(cloudflarePayload);
    if (!rawAdaptation) throw new Error("Cloudflare Workers AI не вернул адаптацию");
    const adaptation = normalizeAdaptation(rawAdaptation);

    const structureIssues = validateStructure(section, adaptation);
    const sourceNumeric = [
      ...extractNumericTokens(section.titleKr || "").map((token) => token.normalized),
      ...section.numericTokens.map((token) => token.normalized),
    ];
    const outputNumericTokens = extractNumericTokens(adaptationText(adaptation));
    const outputNumeric = outputNumericTokens.map((token) => token.normalized);
    const numericPass = sameNumericMultiset(sourceNumeric, outputNumeric);

    const { inputTokens, outputTokenCount } = usageFromCloudflare(cloudflarePayload);
    const neuronEstimate = estimatedNeurons(model, inputTokens, outputTokenCount);

    const content = {
      units: adaptation.units,
      validation: {
        structure_status: structureIssues.length ? "fail" : "pass",
        structure_issues: structureIssues,
      },
      meta: {
        provider: "cloudflare-workers-ai",
        estimated_neurons: neuronEstimate,
        free_daily_budget: 10000,
      },
    };

    const row = {
      snapshot_id: snapshot.id,
      section_id: section.id,
      section_index: sectionIndex,
      section_kind: section.kind,
      title_kr: section.titleKr,
      title_ru: adaptation.title_ru,
      content,
      terms: adaptation.terms,
      source_ordinals: section.sourceOrdinals,
      source_numeric: [
        ...extractNumericTokens(section.titleKr || ""),
        ...section.numericTokens,
      ],
      output_numeric: outputNumericTokens,
      numeric_status: numericPass ? "pass" : "fail",
      terminology_status: adaptation.terms.length ? "review" : "verified",
      status: numericPass && !structureIssues.length ? "review" : "draft",
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokenCount,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: saveError } = await supabase
      .from("kr_ingest_adaptations")
      .upsert(row, { onConflict: "snapshot_id,section_id" })
      .select("id,snapshot_id,section_id,section_index,section_kind,title_kr,title_ru,content,terms,source_ordinals,source_numeric,output_numeric,numeric_status,terminology_status,status,model,input_tokens,output_tokens,updated_at")
      .single();

    if (saveError) {
      const migrationMissing = saveError.code === "42P01" || /kr_ingest_adaptations/i.test(saveError.message || "");
      throw new Error(migrationMissing
        ? "Таблица адаптаций ещё не создана. Выполни docs/kr-adaptation.sql в Supabase."
        : saveError.message);
    }

    return NextResponse.json({
      ok: true,
      provider: "cloudflare-workers-ai",
      model,
      estimatedNeurons: neuronEstimate,
      adaptation: saved,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось адаптировать раздел" },
      { status: 500 },
    );
  }
}
