import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adaptationStructureIssues, normalizeAdaptedUnits, type AdaptedUnitLike } from "@/lib/kr/adaptation-repair";
import { isUsefulKrImage } from "@/lib/kr/media";
import { compareNumericFacts, factsToNumericTokens } from "@/lib/kr/numeric-validation";
import { assembleSemanticSections, type KrSemanticSection, type KrSemanticSourceBlock } from "@/lib/kr/semantic";
import { sourceTableTextRows } from "@/lib/kr/table-geometry";

function sourceSectionText(section: KrSemanticSection) {
  const parts = [section.titleKr || ""];
  for (const unit of section.units) {
    if (unit.type === "text") parts.push(...unit.paragraphs);
    else if (unit.type === "table") parts.push(...sourceTableTextRows(unit.block).flat());
    else if (isUsefulKrImage(unit.block)) parts.push(unit.block.text_kr || "");
  }
  return parts.filter(Boolean).join("\n");
}

function outputSectionText(section: KrSemanticSection, title: string, units: AdaptedUnitLike[]) {
  const parts = [title];
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const sourceUnit = section.units[index];
    if (unit.type === "text") parts.push(...(unit.paragraphs_ru || []));
    else if (unit.type === "table") parts.push(...(unit.rows_ru || []).flat());
    else if (sourceUnit?.type === "image" && isUsefulKrImage(sourceUnit.block) && unit.caption_ru) parts.push(unit.caption_ru);
  }
  return parts.filter(Boolean).join("\n");
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

    const nextContent = {
      ...content,
      units: normalizedUnits,
      validation: {
        ...(content.validation && typeof content.validation === "object" ? content.validation as Record<string, unknown> : {}),
        structure_status: structureIssues.length ? "fail" : "pass",
        structure_issues: structureIssues,
        numeric_fact_differences: numeric.differences,
        repaired_at: new Date().toISOString(),
        repair_version: "kr-repair/0.4",
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

    repaired.push({
      section_id: row.section_id,
      structure_status: structureIssues.length ? "fail" : "pass",
      structure_issues: structureIssues.length,
      numeric_status: numericStatus,
      numeric_differences: numeric.differences,
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
    repaired,
  });
}
