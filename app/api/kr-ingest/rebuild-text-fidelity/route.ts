import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adaptationStructureIssues, normalizeAdaptedUnits, type AdaptedUnitLike } from "@/lib/kr/adaptation-repair";
import { compareNumericFacts, factsToNumericTokens } from "@/lib/kr/numeric-validation";
import { assembleSemanticSections, type KrSemanticSection, type KrSemanticSourceBlock } from "@/lib/kr/semantic";
import { applyVerifiedRuTerminology } from "@/lib/kr/verified-terminology";

const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const BATCH_SIZE = 20;

type TranslationRow = { id: string; text_ru: string };

function sourceUnitText(section: KrSemanticSection) {
  return section.units.map((unit) => {
    if (unit.type === "text") return unit.paragraphs.join("\n");
    if (unit.type === "table") return unit.block.text_kr || "";
    return unit.block.text_kr || "";
  }).join("\n");
}

function outputUnitText(section: KrSemanticSection, title: string, units: AdaptedUnitLike[]) {
  const parts = [title];
  section.units.forEach((source, index) => {
    const unit = units[index];
    if (!unit || unit.type !== source.type) return;
    if (unit.type === "text") parts.push(...(unit.paragraphs_ru || []));
    if (unit.type === "table") (unit.rows_ru || []).forEach((row) => parts.push(...row));
    if (unit.type === "image" && unit.caption_ru) parts.push(unit.caption_ru);
  });
  return parts.join("\n");
}

function stripFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseRows(value: string): TranslationRow[] {
  const cleaned = stripFence(value);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Модель вернула повреждённый JSON");
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Некорректный ответ модели");
  const blocks = (parsed as Record<string, unknown>).blocks;
  if (!Array.isArray(blocks)) throw new Error("В ответе модели нет blocks");
  return blocks.map((row) => {
    if (!row || typeof row !== "object") throw new Error("Некорректный block в ответе модели");
    const record = row as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.text_ru !== "string") throw new Error("Block без id/text_ru");
    return { id: record.id, text_ru: applyVerifiedRuTerminology(record.text_ru) };
  });
}

function cloudflareText(payload: unknown) {
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
      if (message && typeof message === "object") {
        const content = (message as Record<string, unknown>).content;
        if (typeof content === "string") return content;
      }
    }
  }
  return null;
}

async function translateBatch(
  accountId: string,
  apiToken: string,
  edition: string | null,
  sectionTitle: string | null,
  rows: Array<{ id: string; text_kr: string }>,
) {
  const expected = new Set(rows.map((row) => row.id));
  let lastError = "Не удалось перевести пакет";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `Ты локализуешь официальный патчноут Lineage 2 ${edition === "main" ? "Main" : "Essence"} для RedPlay.\n\nКРИТИЧЕСКОЕ ПРАВИЛО: структура PLAYNC неизменна. Каждый входной block переводится ОТДЕЛЬНО и возвращается с ТОЧНО тем же id. Нельзя объединять, делить, переставлять или пропускать blocks.\n\nСохраняй все факты, числа, диапазоны, проценты, уровни, знаки +/-, названия и условия. Если исходный block начинается с номера (например 22.) или маркера -, сохрани этот номер/маркер в переводе. Внутренние переносы строк одного block можно сохранить. Не добавляй анализ или новые факты.\n\nПроверенная терминология RedPlay: Dreadnought = Полководец; Vanguard = Авангард; 마정석 / Magic Crystal = Руда духов.\n\nВерни ТОЛЬКО JSON вида {"blocks":[{"id":"...","text_ru":"..."}]}. Количество blocks и набор id должны в точности совпасть со входом.`,
            },
            {
              role: "user",
              content: JSON.stringify({ section_title_kr: sectionTitle, blocks: rows }),
            },
          ],
          temperature: 0,
          max_tokens: 8000,
          stream: false,
          chat_template_kwargs: { enable_thinking: false },
        }),
      });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok || payload.success === false) throw new Error(`Cloudflare HTTP ${response.status}`);
      const text = cloudflareText(payload);
      if (!text) throw new Error("Cloudflare не вернул текст");
      const translated = parseRows(text);
      const actual = new Set(translated.map((row) => row.id));
      if (translated.length !== rows.length || actual.size !== expected.size || [...expected].some((id) => !actual.has(id))) {
        throw new Error(`Модель изменила source_id: ожидалось ${rows.length}, получено ${translated.length}`);
      }
      return translated;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { snapshotId?: string; sectionId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  if (!body.snapshotId || !body.sectionId) return NextResponse.json({ error: "Нужны snapshotId и sectionId" }, { status: 400 });

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
    const section = sections.find((row) => row.id === body.sectionId);
    if (!section) return NextResponse.json({ error: "Раздел не найден" }, { status: 404 });

    const { data: stored, error: storedError } = await supabase
      .from("kr_ingest_adaptations")
      .select("id,title_ru,content")
      .eq("snapshot_id", snapshot.id)
      .eq("section_id", section.id)
      .single();
    if (storedError || !stored) return NextResponse.json({ error: "Сначала нужен перевод раздела" }, { status: 409 });

    const content = stored.content && typeof stored.content === "object" ? stored.content as Record<string, unknown> : {};
    const currentUnits = Array.isArray(content.units) ? content.units as AdaptedUnitLike[] : [];
    const entries: Array<{ id: string; text_kr: string }> = [];
    const unitsToRebuild = new Set<number>();

    section.units.forEach((unit, unitIndex) => {
      if (unit.type !== "text") return;
      const output = currentUnits[unitIndex];
      const translatedCount = output?.type === "text" && Array.isArray(output.paragraphs_ru) ? output.paragraphs_ru.length : 0;
      if (translatedCount === unit.paragraphs.length) return;
      unitsToRebuild.add(unitIndex);
      unit.paragraphs.forEach((text, paragraphIndex) => entries.push({ id: `${unitIndex}:${paragraphIndex}`, text_kr: text }));
    });

    const translatedMap = new Map<string, string>();
    for (let offset = 0; offset < entries.length; offset += BATCH_SIZE) {
      const translated = await translateBatch(accountId, apiToken, item?.edition || null, section.titleKr, entries.slice(offset, offset + BATCH_SIZE));
      translated.forEach((row) => translatedMap.set(row.id, row.text_ru));
    }

    const nextUnits = currentUnits.map((unit, unitIndex) => {
      const source = section.units[unitIndex];
      if (!unitsToRebuild.has(unitIndex) || !source || source.type !== "text" || unit.type !== "text") return unit;
      return {
        ...unit,
        paragraphs_ru: source.paragraphs.map((_, paragraphIndex) => translatedMap.get(`${unitIndex}:${paragraphIndex}`) || ""),
      };
    });
    const normalizedUnits = normalizeAdaptedUnits(section, nextUnits);
    const structureIssues = adaptationStructureIssues(section, normalizedUnits);
    const numeric = compareNumericFacts(
      [section.titleKr || "", sourceUnitText(section)].filter(Boolean).join("\n"),
      outputUnitText(section, String(stored.title_ru || section.titleKr || ""), normalizedUnits),
    );
    const nextContent = {
      ...content,
      units: normalizedUnits,
      validation: {
        ...(content.validation && typeof content.validation === "object" ? content.validation as Record<string, unknown> : {}),
        structure_status: structureIssues.length ? "fail" : "pass",
        structure_issues: structureIssues,
        numeric_fact_differences: numeric.differences,
        source_fidelity_rebuilt_at: new Date().toISOString(),
      },
    };

    const { error: updateError } = await supabase.from("kr_ingest_adaptations").update({
      content: nextContent,
      output_numeric: factsToNumericTokens(numeric.output),
      numeric_status: numeric.pass ? "pass" : "fail",
      status: numeric.pass && !structureIssues.length ? "review" : "draft",
      updated_at: new Date().toISOString(),
    }).eq("id", stored.id);
    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      sectionId: section.id,
      blocks: entries.length,
      unitsRebuilt: unitsToRebuild.size,
      structureStatus: structureIssues.length ? "fail" : "pass",
      numericStatus: numeric.pass ? "pass" : "fail",
      structureIssues: structureIssues.length,
      numericDifferences: numeric.differences.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось пересобрать структуру" }, { status: 500 });
  }
}
