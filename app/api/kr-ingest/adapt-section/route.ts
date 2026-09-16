import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractNumericTokens } from "@/lib/kr/parser";
import {
  assembleSemanticSections,
  type KrSemanticSection,
  type KrSemanticSourceBlock,
  type KrSemanticUnit,
} from "@/lib/kr/semantic";

const DEFAULT_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_UNITS_PER_REQUEST = 6;
const MAX_FORMAT_ATTEMPTS = 2;

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

type InferenceResult = {
  adaptation: AiAdaptation;
  inputTokens: number | null;
  outputTokenCount: number | null;
  estimatedNeurons: number | null;
  requestCount: number;
};

class ModelFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelFormatError";
  }
}

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

function unitPayload(unit: KrSemanticUnit) {
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
}

function sourceUnitText(unit: KrSemanticUnit) {
  if (unit.type === "text") return unit.paragraphs.join("\n");
  if (unit.type === "table") return tableRows(unit.block).flat().join("\n");
  return unit.block.text_kr || "";
}

function sourcePayload(
  section: KrSemanticSection,
  units: KrSemanticUnit[] = section.units,
  batchIndex = 0,
  batchCount = 1,
) {
  const unitText = units.map(sourceUnitText).join("\n");
  return {
    section_id: section.id,
    kind: section.kind,
    section_title_kr: section.titleKr,
    batch: { index: batchIndex + 1, total: batchCount },
    units: units.map(unitPayload),
    numeric_tokens: extractNumericTokens(unitText).map((token) => token.raw),
  };
}

function systemInstruction(edition: string | null) {
  return `Ты редактор RedPlay и локализуешь официальный корейский патчноут Lineage 2 ${edition === "main" ? "Main" : "Essence"} на русский язык.

Правила обязательны:
1. Перед тобой один ЦЕЛЫЙ смысловой раздел или последовательный пакет units из этого раздела. section_title_kr всегда содержит заголовок всего смыслового раздела. Переводи предоставленные units как часть единого нормального материала, не как разрозненные RAW-фрагменты.
2. Нельзя сокращать факты, строки таблиц, условия, ограничения, уровни, проценты, количества или примечания. Не добавляй игровой анализ и новые факты на этом этапе.
3. Сохрани порядок и количество ПЕРЕДАННЫХ units. type каждого output unit должен совпадать с соответствующим input unit.
4. Для table сохрани ТОЧНО то же количество строк и ячеек в каждой строке. Переводи только текст ячеек.
5. ВСЕ числа, знаки +/-, проценты и диапазоны должны сохранить исходные значения. Исключение: календарный месяц в корейской дате можно естественно локализовать словом, например 9월 16일 → 16 сентября. Не пересчитывай игровые числа и не добавляй собственные числа.
6. Русский текст должен звучать естественно для игрока Lineage 2, а не как машинный подстрочник.
7. Игровые названия: если корейское имя уверенно восстанавливается как английское название, используй формат English Name (Русское название). Не выдавай предложенный русский вариант за официальную локализацию. Добавь такую сущность в terms со status=unverified.
8. Если английское имя нельзя восстановить уверенно, не выдумывай его: сохрани корейское имя в en и дай осторожный русский вариант в ru/display, status всё равно unverified.
9. Для text заполняй paragraphs_ru, для table – rows_ru, для image – caption_ru. Неиспользуемые поля оставляй пустым массивом или пустой строкой.
10. title_ru всегда должен быть переводом section_title_kr, даже если это не первый пакет раздела.
11. Ответ должен быть ТОЛЬКО валидным JSON без Markdown и без пояснений вокруг него, строго такой формы:
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
  } catch (firstError) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
      } catch {
        // handled below
      }
    }
    throw new ModelFormatError(
      firstError instanceof Error ? `Модель вернула повреждённый JSON: ${firstError.message}` : "Модель не вернула валидный JSON",
    );
  }
}

function normalizeAdaptation(value: unknown): AiAdaptation {
  if (!value || typeof value !== "object") throw new ModelFormatError("Некорректная структура адаптации");
  const root = value as Record<string, unknown>;
  if (typeof root.title_ru !== "string" || !Array.isArray(root.units)) {
    throw new ModelFormatError("В адаптации отсутствует title_ru или units");
  }

  const units: AiUnit[] = root.units.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new ModelFormatError(`Unit ${index + 1}: некорректный объект`);
    const unit = entry as Record<string, unknown>;
    const type = unit.type;
    if (type !== "text" && type !== "table" && type !== "image") {
      throw new ModelFormatError(`Unit ${index + 1}: неизвестный type`);
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

const RU_MONTH_PATTERNS: Record<string, RegExp> = {
  "1": /январ(?:ь|я|е|ю)/gi,
  "2": /феврал(?:ь|я|е|ю)/gi,
  "3": /март(?:а|е|у)?/gi,
  "4": /апрел(?:ь|я|е|ю)/gi,
  "5": /ма(?:й|я|е|ю)/gi,
  "6": /июн(?:ь|я|е|ю)/gi,
  "7": /июл(?:ь|я|е|ю)/gi,
  "8": /август(?:а|е|у)?/gi,
  "9": /сентябр(?:ь|я|е|ю)/gi,
  "10": /октябр(?:ь|я|е|ю)/gi,
  "11": /ноябр(?:ь|я|е|ю)/gi,
  "12": /декабр(?:ь|я|е|ю)/gi,
};

function expectedNumericWithCalendarLocalization(section: KrSemanticSection, outputText: string) {
  const original = [
    ...extractNumericTokens(section.titleKr || "").map((token) => token.normalized),
    ...section.numericTokens.map((token) => token.normalized),
  ];
  const sourceText = [section.titleKr || "", ...section.units.map(sourceUnitText)].join("\n");
  const sourceMonthCounts = new Map<string, number>();
  const monthRegex = /(^|[^0-9])(1[0-2]|[1-9])\s*월/g;
  let match: RegExpExecArray | null;
  while ((match = monthRegex.exec(sourceText)) !== null) {
    const month = match[2];
    sourceMonthCounts.set(month, (sourceMonthCounts.get(month) || 0) + 1);
  }

  const removable = new Map<string, number>();
  for (const [month, count] of sourceMonthCounts) {
    const pattern = RU_MONTH_PATTERNS[month];
    const localizedCount = pattern ? (outputText.match(pattern)?.length || 0) : 0;
    if (localizedCount) removable.set(month, Math.min(count, localizedCount));
  }

  if (!removable.size) return { expected: original, calendarAllowances: {} as Record<string, number> };

  const leftToRemove = new Map(removable);
  const expected = original.filter((value) => {
    const remaining = leftToRemove.get(value) || 0;
    if (!remaining) return true;
    leftToRemove.set(value, remaining - 1);
    return false;
  });
  return { expected, calendarAllowances: Object.fromEntries(removable) };
}

function validateUnitShape(sourceUnits: KrSemanticUnit[], adaptation: AiAdaptation) {
  if (adaptation.units.length !== sourceUnits.length) {
    return `Ожидалось units: ${sourceUnits.length}, получено: ${adaptation.units.length}`;
  }
  for (let index = 0; index < sourceUnits.length; index += 1) {
    if (sourceUnits[index].type !== adaptation.units[index].type) {
      return `Unit ${index + 1}: ${sourceUnits[index].type} → ${adaptation.units[index].type}`;
    }
  }
  return null;
}

function validateStructure(section: KrSemanticSection, adaptation: AiAdaptation) {
  const issues: string[] = [];
  const shapeIssue = validateUnitShape(section.units, adaptation);
  if (shapeIssue) issues.push(shapeIssue);

  const count = Math.min(section.units.length, adaptation.units.length);
  for (let i = 0; i < count; i += 1) {
    const source = section.units[i];
    const output = adaptation.units[i];
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

function mergeTerms(groups: AiTerm[][]) {
  const seen = new Set<string>();
  const merged: AiTerm[] = [];
  for (const terms of groups) {
    for (const term of terms) {
      const key = `${term.kr}\u0000${term.en}\u0000${term.ru}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(term);
    }
  }
  return merged;
}

function sumNullable(values: Array<number | null>) {
  const known = values.filter((value): value is number => value != null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}

async function inferUnits({
  section,
  units,
  edition,
  accountId,
  apiToken,
  model,
  batchIndex,
  batchCount,
}: {
  section: KrSemanticSection;
  units: KrSemanticUnit[];
  edition: string | null;
  accountId: string;
  apiToken: string;
  model: SupportedModel;
  batchIndex: number;
  batchCount: number;
}): Promise<InferenceResult> {
  let lastFormatError: Error | null = null;

  for (let attempt = 0; attempt < MAX_FORMAT_ATTEMPTS; attempt += 1) {
    const inferenceInput: Record<string, unknown> = {
      messages: [
        { role: "system", content: systemInstruction(edition) },
        {
          role: "user",
          content: JSON.stringify({
            ...sourcePayload(section, units, batchIndex, batchCount),
            retry_instruction: attempt
              ? "Повтор: предыдущий ответ был повреждён или нарушил форму. Верни только строгий валидный JSON и ровно столько units, сколько получено."
              : undefined,
          }),
        },
      ],
      temperature: attempt ? 0 : 0.1,
      max_tokens: 10000,
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

    try {
      const rawAdaptation = cloudflareOutput(cloudflarePayload);
      if (!rawAdaptation) throw new ModelFormatError("Cloudflare Workers AI не вернул адаптацию");
      const adaptation = normalizeAdaptation(rawAdaptation);
      const shapeIssue = validateUnitShape(units, adaptation);
      if (shapeIssue) throw new ModelFormatError(shapeIssue);

      const { inputTokens, outputTokenCount } = usageFromCloudflare(cloudflarePayload);
      return {
        adaptation,
        inputTokens,
        outputTokenCount,
        estimatedNeurons: estimatedNeurons(model, inputTokens, outputTokenCount),
        requestCount: 1,
      };
    } catch (error) {
      if (!(error instanceof ModelFormatError)) throw error;
      lastFormatError = error;
    }
  }

  throw new ModelFormatError(lastFormatError?.message || "Модель дважды вернула некорректный формат");
}

async function inferUnitsAdaptive(args: Parameters<typeof inferUnits>[0]): Promise<InferenceResult> {
  try {
    return await inferUnits(args);
  } catch (error) {
    if (!(error instanceof ModelFormatError) || args.units.length <= 1) throw error;

    const middle = Math.ceil(args.units.length / 2);
    const left = await inferUnitsAdaptive({ ...args, units: args.units.slice(0, middle) });
    const right = await inferUnitsAdaptive({ ...args, units: args.units.slice(middle) });
    return {
      adaptation: {
        title_ru: left.adaptation.title_ru || right.adaptation.title_ru,
        units: [...left.adaptation.units, ...right.adaptation.units],
        terms: mergeTerms([left.adaptation.terms, right.adaptation.terms]),
      },
      inputTokens: sumNullable([left.inputTokens, right.inputTokens]),
      outputTokenCount: sumNullable([left.outputTokenCount, right.outputTokenCount]),
      estimatedNeurons: sumNullable([left.estimatedNeurons, right.estimatedNeurons]),
      requestCount: left.requestCount + right.requestCount,
    };
  }
}

async function inferSection(args: {
  section: KrSemanticSection;
  edition: string | null;
  accountId: string;
  apiToken: string;
  model: SupportedModel;
}) {
  const chunks: KrSemanticUnit[][] = [];
  for (let index = 0; index < args.section.units.length; index += MAX_UNITS_PER_REQUEST) {
    chunks.push(args.section.units.slice(index, index + MAX_UNITS_PER_REQUEST));
  }

  const results: InferenceResult[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    results.push(await inferUnitsAdaptive({
      ...args,
      units: chunks[index],
      batchIndex: index,
      batchCount: chunks.length,
    }));
  }

  return {
    adaptation: {
      title_ru: results.find((result) => result.adaptation.title_ru)?.adaptation.title_ru || args.section.titleKr || "",
      units: results.flatMap((result) => result.adaptation.units),
      terms: mergeTerms(results.map((result) => result.adaptation.terms)),
    } as AiAdaptation,
    inputTokens: sumNullable(results.map((result) => result.inputTokens)),
    outputTokenCount: sumNullable(results.map((result) => result.outputTokenCount)),
    estimatedNeurons: sumNullable(results.map((result) => result.estimatedNeurons)),
    requestCount: results.reduce((sum, result) => sum + result.requestCount, 0),
    batchCount: chunks.length,
  };
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

    const inference = await inferSection({
      section,
      edition: item?.edition || null,
      accountId,
      apiToken,
      model,
    });
    const adaptation = inference.adaptation;

    const structureIssues = validateStructure(section, adaptation);
    const outputText = adaptationText(adaptation);
    const outputNumericTokens = extractNumericTokens(outputText);
    const outputNumeric = outputNumericTokens.map((token) => token.normalized);
    const { expected: sourceNumeric, calendarAllowances } = expectedNumericWithCalendarLocalization(section, outputText);
    const numericPass = sameNumericMultiset(sourceNumeric, outputNumeric);

    const content = {
      units: adaptation.units,
      validation: {
        structure_status: structureIssues.length ? "fail" : "pass",
        structure_issues: structureIssues,
        calendar_numeric_allowances: calendarAllowances,
      },
      meta: {
        provider: "cloudflare-workers-ai",
        estimated_neurons: inference.estimatedNeurons,
        free_daily_budget: 10000,
        batches: inference.batchCount,
        ai_requests: inference.requestCount,
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
      input_tokens: inference.inputTokens,
      output_tokens: inference.outputTokenCount,
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
      estimatedNeurons: inference.estimatedNeurons,
      batches: inference.batchCount,
      aiRequests: inference.requestCount,
      adaptation: saved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось адаптировать раздел";
    return NextResponse.json(
      { error: error instanceof ModelFormatError ? `Модель не смогла стабильно сформировать JSON даже после уменьшения пакета: ${message}` : message },
      { status: 500 },
    );
  }
}
