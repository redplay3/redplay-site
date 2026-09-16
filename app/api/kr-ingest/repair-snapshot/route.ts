import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adaptationStructureIssues, normalizeAdaptedUnits, type AdaptedUnitLike } from "@/lib/kr/adaptation-repair";
import { isUsefulKrImage } from "@/lib/kr/media";
import { compareNumericFacts, factsToNumericTokens } from "@/lib/kr/numeric-validation";
import { assembleSemanticSections, type KrSemanticSection, type KrSemanticSourceBlock, type KrSemanticUnit } from "@/lib/kr/semantic";
import { sourceTableTextRows, translatedTableShapeIssues } from "@/lib/kr/table-geometry";

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
  return [
    title,
    ...section.units.map((sourceUnit, index) => outputUnitText(sourceUnit, units[index])),
  ].filter(Boolean).join("\n");
}

function failedUnitIndexes(section: KrSemanticSection, units: AdaptedUnitLike[]) {
  const failed = new Set<number>();

  for (let index = 0; index < section.units.length; index += 1) {
    const source = section.units[index];
    const output = units[index];
    if (!output || source.type !== output.type) {
      failed.add(index);
      continue;
    }

    if (source.type === "table" && output.type === "table") {
      if (translatedTableShapeIssues(source.block, Array.isArray(output.rows_ru) ? output.rows_ru : []).length) {
        failed.add(index);
      }
    }

    const sourceText = sourceUnitText(source);
    const outputText = outputUnitText(source, output);
    if (sourceText && !compareNumericFacts(sourceText, outputText).pass) failed.add(index);
  }

  return [...failed].sort((a, b) => a - b);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { snapshotId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  if (!body.snapshotId) return NextResponse.json({ error: "Нужен snapshotId" }, { status: 400 });

  const { data: rawBlocks, error: blockError } = await supabase
    .from("kr_ingest_blocks")
    .select("id,ordinal,block_type,source_type,text_kr,raw_html,data")
    .eq("snapshot_id", body.snapshotId)
    .order("ordinal", { ascending: true });
  if (blockError) return NextResponse.json({ error: blockError.message }, { status: 500 });

  const sections = assembleSemanticSections((rawBlocks || []) as KrSemanticSourceBlock[]);
  const sectionMap = new Map(sections.map((section) => [section.id, section]));

  const { data: rows, error: adaptationError } = await supabase
    .from("kr_ingest_adaptations")
    .select("id,section_id,title_ru,content,status,numeric_status")
    .eq("snapshot_id", body.snapshotId)
    .order("section_index", { ascending: true });
  if (adaptationError) return NextResponse.json({ error: adaptationError.message }, { status: 500 });

  const repaired: Array<Record<string, unknown>> = [];
  const failedUnits: Array<{ section_id: string; unit_indexes: number[] }> = [];

  for (const row of rows || []) {
    const section = sectionMap.get(row.section_id);
    if (!section) continue;
    const content = row.content && typeof row.content === "object" ? row.content as Record<string, unknown> : {};
    const units = Array.isArray(content.units) ? content.units as AdaptedUnitLike[] : [];
    const normalizedUnits = normalizeAdaptedUnits(section, units);
    const structureIssues = adaptationStructureIssues(section, normalizedUnits);
    const sourceText = sourceSectionText(section);
    const outputText = outputSectionText(section, String(row.title_ru || section.titleKr || ""), normalizedUnits);
    const numeric = compareNumericFacts(sourceText, outputText);
    const unitIndexes = failedUnitIndexes(section, normalizedUnits);

    // A rare title-only numeric mismatch has no unit to target. Rebuild the first text
    // unit rather than falling back to rebuilding a whole large section.
    if ((structureIssues.length || !numeric.pass) && !unitIndexes.length && section.units.length) {
      unitIndexes.push(0);
    }

    const nextContent = {
      ...content,
      units: normalizedUnits,
      validation: {
        ...(content.validation && typeof content.validation === "object" ? content.validation as Record<string, unknown> : {}),
        structure_status: structureIssues.length ? "fail" : "pass",
        structure_issues: structureIssues,
        numeric_fact_differences: numeric.differences,
        failed_unit_indexes: unitIndexes,
        repaired_at: new Date().toISOString(),
        repair_version: "kr-repair/0.5",
      },
    };

    const numericStatus = numeric.pass ? "pass" : "fail";
    const status = numeric.pass && !structureIssues.length ? "review" : "draft";
    const { error: updateError } = await supabase
      .from("kr_ingest_adaptations")
      .update({
        content: nextContent,
        output_numeric: factsToNumericTokens(numeric.output),
        numeric_status: numericStatus,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    if (unitIndexes.length) failedUnits.push({ section_id: row.section_id, unit_indexes: unitIndexes });
    repaired.push({
      section_id: row.section_id,
      structure_status: structureIssues.length ? "fail" : "pass",
      structure_issues: structureIssues.length,
      numeric_status: numericStatus,
      numeric_differences: numeric.differences,
      failed_unit_indexes: unitIndexes,
    });
  }

  const structureFailures = repaired.filter((item) => item.structure_status === "fail").length;
  const numericFailures = repaired.filter((item) => item.numeric_status === "fail").length;
  return NextResponse.json({
    ok: true,
    sections: sections.length,
    adaptations: repaired.length,
    structureFailures,
    numericFailures,
    ready: repaired.length >= sections.length && structureFailures === 0 && numericFailures === 0,
    failedUnits,
    repaired,
  });
}
