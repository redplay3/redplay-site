import type { KrSemanticSection } from "@/lib/kr/semantic";
import { normalizeTranslatedTableRows, translatedTableShapeIssues } from "@/lib/kr/table-geometry";
import { applyVerifiedRuTerminology } from "@/lib/kr/verified-terminology";

export type AdaptedUnitLike = {
  type: "text" | "table" | "image";
  paragraphs_ru?: string[];
  rows_ru?: string[][];
  caption_ru?: string;
};

function sanitizeUnit(unit: AdaptedUnitLike): AdaptedUnitLike {
  if (unit.type === "text") {
    return {
      ...unit,
      paragraphs_ru: (unit.paragraphs_ru || []).map((value) => applyVerifiedRuTerminology(String(value ?? ""))),
    };
  }
  if (unit.type === "table") {
    return {
      ...unit,
      rows_ru: (unit.rows_ru || []).map((row) => row.map((value) => applyVerifiedRuTerminology(String(value ?? "")))),
    };
  }
  return {
    ...unit,
    caption_ru: applyVerifiedRuTerminology(String(unit.caption_ru || "")),
  };
}

export function normalizeAdaptedUnits(section: KrSemanticSection, units: AdaptedUnitLike[]) {
  return units.map((rawUnit, index) => {
    const unit = sanitizeUnit(rawUnit);
    const source = section.units[index];
    if (unit.type !== "table" || source?.type !== "table") return unit;
    return {
      ...unit,
      rows_ru: normalizeTranslatedTableRows(source.block, Array.isArray(unit.rows_ru) ? unit.rows_ru : []),
    };
  });
}

export function adaptationStructureIssues(section: KrSemanticSection, units: AdaptedUnitLike[]) {
  const issues: string[] = [];
  if (section.units.length !== units.length) {
    issues.push(`Ожидалось units: ${section.units.length}, получено: ${units.length}`);
  }

  const count = Math.min(section.units.length, units.length);
  for (let index = 0; index < count; index += 1) {
    const source = section.units[index];
    const output = units[index];
    if (source.type !== output.type) {
      issues.push(`Unit ${index + 1}: ${source.type} → ${output.type}`);
      continue;
    }

    if (source.type === "text" && output.type === "text") {
      const translated = Array.isArray(output.paragraphs_ru) ? output.paragraphs_ru : [];
      if (source.paragraphs.length !== translated.length) {
        issues.push(`Текст ${index + 1}: блоков ${source.paragraphs.length} → ${translated.length}`);
      }
    }

    if (source.type === "table" && output.type === "table") {
      for (const issue of translatedTableShapeIssues(source.block, Array.isArray(output.rows_ru) ? output.rows_ru : [])) {
        issues.push(`Таблица ${index + 1}: ${issue}`);
      }
    }
  }
  return issues;
}
