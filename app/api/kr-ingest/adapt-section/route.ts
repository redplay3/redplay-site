import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractNumericTokens } from "@/lib/kr/parser";
import { assembleSemanticSections, type KrSemanticSection, type KrSemanticSourceBlock } from "@/lib/kr/semantic";

export const maxDuration = 120;

const DEFAULT_MODEL = "gpt-5.6-terra";

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

function tableRows(block: KrSemanticSourceBlock) {
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
          rows_kr: [],
          image_src: "",
          image_alt_kr: "",
        };
      }
      if (unit.type === "table") {
        return {
          type: "table",
          paragraphs_kr: [],
          rows_kr: tableRows(unit.block),
          image_src: "",
          image_alt_kr: "",
        };
      }
      return {
        type: "image",
        paragraphs_kr: [],
        rows_kr: [],
        image_src: typeof unit.block.data?.src === "string" ? unit.block.data.src : "",
        image_alt_kr: unit.block.text_kr || "",
      };
    }),
    numeric_tokens: section.numericTokens.map((token) => token.raw),
  };
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title_ru: { type: "string" },
    units: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["text", "table", "image"] },
          paragraphs_ru: { type: "array", items: { type: "string" } },
          rows_ru: {
            type: "array",
            items: { type: "array", items: { type: "string" } },
          },
          caption_ru: { type: "string" },
        },
        required: ["type", "paragraphs_ru", "rows_ru", "caption_ru"],
      },
    },
    terms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kr: { type: "string" },
          en: { type: "string" },
          ru: { type: "string" },
          display: { type: "string" },
          status: { type: "string", enum: ["unverified"] },
        },
        required: ["kr", "en", "ru", "display", "status"],
      },
    },
  },
  required: ["title_ru", "units", "terms"],
} as const;

function systemInstruction(edition: string | null) {
  return `Ты редактор RedPlay и локализуешь официальный корейский патчноут Lineage 2 ${edition === "main" ? "Main" : "Essence"} на русский язык.

Правила обязательны:
1. Перед тобой уже не DOM-фрагменты, а один ЦЕЛЫЙ смысловой раздел. Переводи и адаптируй его как единый раздел нормальной статьи.
2. Нельзя сокращать факты, строки таблиц, условия, ограничения, уровни, проценты, количества или примечания. Не добавляй игровой анализ и новые факты на этом этапе.
3. Сохрани порядок и количество units. type каждого output unit должен совпадать с соответствующим input unit.
4. Для table сохрани ТОЧНО то же количество строк и ячеек в каждой строке. Переводи только текст ячеек.
5. ВСЕ числа, знаки +/-, проценты и диапазоны должны сохранить исходные значения. Не пересчитывай проценты и не добавляй собственные числа.
6. Русский текст должен звучать естественно для игрока Lineage 2, а не как машинный подстрочник.
7. Игровые названия: если корейское имя уверенно восстанавливается как английское название, используй формат English Name (Русское название). Не выдавай предложенный русский вариант за официальную локализацию. Добавь такую сущность в terms со status=unverified.
8. Если английское имя нельзя восстановить уверенно, не выдумывай его: сохрани корейское имя в en и дай осторожный русский вариант в ru/display, status всё равно unverified.
9. Для text заполняй paragraphs_ru, для table – rows_ru, для image – caption_ru. Неиспользуемые поля оставляй пустым массивом или пустой строкой.
10. Верни только JSON по заданной схеме.`;
}

function responseOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (typeof root.output_text === "string" && root.output_text) return root.output_text;
  if (!Array.isArray(root.output)) return null;
  for (const item of root.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const record = part as Record<string, unknown>;
      if (record.type === "output_text" && typeof record.text === "string") return record.text;
    }
  }
  return null;
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

  let payload: { snapshotId?: string; sectionId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  if (!payload.snapshotId || !payload.sectionId) {
    return NextResponse.json({ error: "Нужны snapshotId и sectionId" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "В Vercel не задан OPENAI_API_KEY" }, { status: 503 });
  }
  const model = process.env.KR_TRANSLATION_MODEL || DEFAULT_MODEL;

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

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "medium" },
        instructions: systemInstruction(item?.edition || null),
        input: JSON.stringify(sourcePayload(section)),
        max_output_tokens: 16000,
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "redplay_kr_section",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
    });

    const aiPayload = await openAiResponse.json() as Record<string, unknown>;
    if (!openAiResponse.ok) {
      const errorValue = aiPayload.error;
      const message = errorValue && typeof errorValue === "object" && typeof (errorValue as Record<string, unknown>).message === "string"
        ? String((errorValue as Record<string, unknown>).message)
        : `OpenAI API HTTP ${openAiResponse.status}`;
      throw new Error(message);
    }

    const outputText = responseOutputText(aiPayload);
    if (!outputText) throw new Error("Модель не вернула структурированный текст");

    let adaptation: AiAdaptation;
    try {
      adaptation = JSON.parse(outputText) as AiAdaptation;
    } catch {
      throw new Error("Не удалось разобрать JSON адаптации");
    }

    const structureIssues = validateStructure(section, adaptation);
    const sourceNumeric = section.numericTokens.map((token) => token.normalized);
    const outputTokens = extractNumericTokens(adaptationText(adaptation));
    const outputNumeric = outputTokens.map((token) => token.normalized);
    const numericPass = sameNumericMultiset(sourceNumeric, outputNumeric);

    const usage = aiPayload.usage && typeof aiPayload.usage === "object" ? aiPayload.usage as Record<string, unknown> : {};
    const inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : null;
    const outputTokenCount = typeof usage.output_tokens === "number" ? usage.output_tokens : null;

    const content = {
      units: adaptation.units,
      validation: {
        structure_status: structureIssues.length ? "fail" : "pass",
        structure_issues: structureIssues,
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
      source_numeric: section.numericTokens,
      output_numeric: outputTokens,
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
      throw new Error(migrationMissing ? "Примени миграцию docs/kr-adaptation.sql в Supabase" : saveError.message);
    }

    return NextResponse.json({ ok: true, adaptation: saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось адаптировать раздел" }, { status: 500 });
  }
}
