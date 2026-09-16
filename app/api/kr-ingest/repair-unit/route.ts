import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adaptationStructureIssues, normalizeAdaptedUnits, type AdaptedUnitLike } from "@/lib/kr/adaptation-repair";
import { isUsefulKrImage } from "@/lib/kr/media";
import { compareNumericFacts, factsToNumericTokens } from "@/lib/kr/numeric-validation";
import { assembleSemanticSections, type KrSemanticSection, type KrSemanticSourceBlock, type KrSemanticUnit } from "@/lib/kr/semantic";
import { normalizeTranslatedTableRows, sourceTableTextRows } from "@/lib/kr/table-geometry";

const MODEL = "@cf/google/gemma-4-26b-a4b-it";

function sourceUnitPayload(unit: KrSemanticUnit) {
  if (unit.type === "text") return { type: "text", paragraphs_kr: unit.paragraphs, rows_kr: [], image_alt_kr: "" };
  if (unit.type === "table") return { type: "table", paragraphs_kr: [], rows_kr: sourceTableTextRows(unit.block), image_alt_kr: "" };
  return { type: "image", paragraphs_kr: [], rows_kr: [], image_alt_kr: unit.block.text_kr || "" };
}

function sourceUnitText(unit: KrSemanticUnit) {
  if (unit.type === "text") return unit.paragraphs.join("\n");
  if (unit.type === "table") return sourceTableTextRows(unit.block).flat().join("\n");
  return isUsefulKrImage(unit.block) ? (unit.block.text_kr || "") : "";
}

function outputUnitText(sourceUnit: KrSemanticUnit, unit: AdaptedUnitLike | undefined) {
  if (!unit || sourceUnit.type !== unit.type) return "";
  if (unit.type === "text") return (unit.paragraphs_ru || []).join("\n");
  if (unit.type === "table") return (unit.rows_ru || []).flat().join("\n");
  return isUsefulKrImage(sourceUnit.block) ? String(unit.caption_ru || "") : "";
}

function sourceSectionText(section: KrSemanticSection) {
  return [section.titleKr || "", ...section.units.map(sourceUnitText)].filter(Boolean).join("\n");
}

function outputSectionText(section: KrSemanticSection, title: string, units: AdaptedUnitLike[]) {
  return [title, ...section.units.map((source, index) => outputUnitText(source, units[index]))].filter(Boolean).join("\n");
}

function stripCodeFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseModelJson(value: string) {
  const cleaned = stripCodeFence(value);
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    throw new Error("Модель вернула повреждённый JSON");
  }
}

function extractCloudflareText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const result = (payload as Record<string, unknown>).result;
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  if (typeof record.response === "string") return record.response;
  if (record.response && typeof record.response === "object") return JSON.stringify(record.response);
  if (Array.isArray(record.choices)) {
    const first = record.choices[0];
    if (first && typeof first === "object") {
      const message = (first as Record<string, unknown>).message;
      if (message && typeof message === "object" && typeof (message as Record<string, unknown>).content === "string") {
        return String((message as Record<string, unknown>).content);
      }
    }
  }
  return null;
}

function normalizeUnit(raw: Record<string, unknown>, source: KrSemanticUnit): AdaptedUnitLike {
  const candidate = raw.unit && typeof raw.unit === "object" ? raw.unit as Record<string, unknown> : raw;
  const type = candidate.type;
  if (type !== source.type) throw new Error(`Модель вернула type ${String(type)} вместо ${source.type}`);

  if (source.type === "text") {
    const paragraphs = Array.isArray(candidate.paragraphs_ru) ? candidate.paragraphs_ru.map((value) => String(value ?? "")) : [];
    if (!paragraphs.length) throw new Error("Модель не вернула paragraphs_ru");
    return { type: "text", paragraphs_ru: paragraphs, rows_ru: [], caption_ru: "" };
  }
  if (source.type === "table") {
    const rows = Array.isArray(candidate.rows_ru)
      ? candidate.rows_ru.filter(Array.isArray).map((row) => row.map((value) => String(value ?? "")))
      : [];
    if (!rows.length) throw new Error("Модель не вернула rows_ru");
    return { type: "table", paragraphs_ru: [], rows_ru: normalizeTranslatedTableRows(source.block, rows), caption_ru: "" };
  }
  return { type: "image", paragraphs_ru: [], rows_ru: [], caption_ru: String(candidate.caption_ru || "") };
}

function usage(payload: unknown) {
  if (!payload || typeof payload !== "object") return { input: 0, output: 0 };
  const root = payload as Record<string, unknown>;
  const result = root.result && typeof root.result === "object" ? root.result as Record<string, unknown> : {};
  const raw = result.usage && typeof result.usage === "object" ? result.usage as Record<string, unknown> : {};
  return {
    input: Number(raw.prompt_tokens || raw.input_tokens || 0) || 0,
    output: Number(raw.completion_tokens || raw.output_tokens || 0) || 0,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { snapshotId?: string; sectionId?: string; unitIndex?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  if (!body.snapshotId || !body.sectionId || !Number.isInteger(body.unitIndex)) {
    return NextResponse.json({ error: "Нужны snapshotId, sectionId и unitIndex" }, { status: 400 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return NextResponse.json({ error: "Cloudflare AI не настроен" }, { status: 503 });

  try {
    const { data: snapshot } = await supabase.from("kr_ingest_snapshots").select("id,item_id").eq("id", body.snapshotId).single();
    if (!snapshot) return NextResponse.json({ error: "Snapshot не найден" }, { status: 404 });
    const { data: item } = await supabase.from("kr_ingest_items").select("edition").eq("id", snapshot.item_id).single();
    const { data: blockData, error: blockError } = await supabase
      .from("kr_ingest_blocks")
      .select("id,ordinal,block_type,source_type,text_kr,raw_html,data")
      .eq("snapshot_id", snapshot.id)
      .order("ordinal", { ascending: true });
    if (blockError) throw blockError;

    const sections = assembleSemanticSections((blockData || []) as KrSemanticSourceBlock[]);
    const section = sections.find((value) => value.id === body.sectionId);
    if (!section) return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });
    const unitIndex = Number(body.unitIndex);
    const sourceUnit = section.units[unitIndex];
    if (!sourceUnit) return NextResponse.json({ error: "Unit не найден" }, { status: 404 });

    const { data: stored, error: storedError } = await supabase
      .from("kr_ingest_adaptations")
      .select("id,title_ru,content,terms,input_tokens,output_tokens")
      .eq("snapshot_id", snapshot.id)
      .eq("section_id", section.id)
      .single();
    if (storedError || !stored) return NextResponse.json({ error: "Сначала нужен существующий перевод раздела" }, { status: 409 });

    const prompt = `Ты редактор RedPlay. Исправь ТОЛЬКО один проблемный unit русского перевода официального патчноута Lineage 2 ${item?.edition === "main" ? "Main" : "Essence"}.
Сохрани все факты и ВСЕ игровые числа. Не сокращай строки. Не добавляй анализ.
Если это table: верни ТОЧНО столько же физических строк и ячеек в каждой строке, сколько в rows_kr. Не разворачивай rowspan пустыми ячейками. Чистые числа не меняй.
Если это text: сохрани все предложения, условия и числа, но русский должен звучать естественно.
Верни ТОЛЬКО JSON: {"unit":{"type":"text|table|image","paragraphs_ru":[],"rows_ru":[],"caption_ru":""}}`;

    const aiResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify({ section_title_kr: section.titleKr, unit_index: unitIndex, unit: sourceUnitPayload(sourceUnit) }) },
        ],
        temperature: 0,
        max_tokens: 9000,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });

    const aiPayload = await aiResponse.json() as Record<string, unknown>;
    if (!aiResponse.ok || aiPayload.success === false) {
      const errors = Array.isArray(aiPayload.errors) ? aiPayload.errors : [];
      const message = errors[0] && typeof errors[0] === "object" ? String((errors[0] as Record<string, unknown>).message || "") : "";
      throw new Error(message || `Cloudflare HTTP ${aiResponse.status}`);
    }
    const text = extractCloudflareText(aiPayload);
    if (!text) throw new Error("Cloudflare не вернул текст");
    const repairedUnit = normalizeUnit(parseModelJson(text), sourceUnit);

    const content = stored.content && typeof stored.content === "object" ? stored.content as Record<string, unknown> : {};
    const currentUnits = Array.isArray(content.units) ? content.units as AdaptedUnitLike[] : [];
    const nextUnits = [...currentUnits];
    nextUnits[unitIndex] = repairedUnit;
    const normalizedUnits = normalizeAdaptedUnits(section, nextUnits);
    const structureIssues = adaptationStructureIssues(section, normalizedUnits);
    const numeric = compareNumericFacts(
      sourceSectionText(section),
      outputSectionText(section, String(stored.title_ru || section.titleKr || ""), normalizedUnits),
    );
    const nextContent = {
      ...content,
      units: normalizedUnits,
      validation: {
        ...(content.validation && typeof content.validation === "object" ? content.validation as Record<string, unknown> : {}),
        structure_status: structureIssues.length ? "fail" : "pass",
        structure_issues: structureIssues,
        numeric_fact_differences: numeric.differences,
        unit_repair_at: new Date().toISOString(),
      },
    };
    const tokenUsage = usage(aiPayload);
    const { error: updateError } = await supabase.from("kr_ingest_adaptations").update({
      content: nextContent,
      output_numeric: factsToNumericTokens(numeric.output),
      numeric_status: numeric.pass ? "pass" : "fail",
      status: numeric.pass && !structureIssues.length ? "review" : "draft",
      input_tokens: Number(stored.input_tokens || 0) + tokenUsage.input,
      output_tokens: Number(stored.output_tokens || 0) + tokenUsage.output,
      updated_at: new Date().toISOString(),
    }).eq("id", stored.id);
    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      sectionId: section.id,
      unitIndex,
      structureStatus: structureIssues.length ? "fail" : "pass",
      numericStatus: numeric.pass ? "pass" : "fail",
      structureIssues: structureIssues.length,
      numericDifferences: numeric.differences.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось починить unit" }, { status: 500 });
  }
}
