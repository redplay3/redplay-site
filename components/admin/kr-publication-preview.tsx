import { KrPublicationTable } from "@/components/admin/kr-publication-table";
import { isUsefulKrImage } from "@/lib/kr/media";
import { assembleSemanticSections, type KrSemanticSourceBlock } from "@/lib/kr/semantic";
import { sourceTableCells } from "@/lib/kr/table-geometry";
import type { KrStoredAdaptation } from "@/components/admin/kr-review-tabs";

type AdaptedUnit = {
  type: "text" | "table" | "image";
  paragraphs_ru?: string[];
  rows_ru?: string[][];
  caption_ru?: string;
};

function paragraphLines(value: string) {
  return value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function TextUnit({ paragraphs }: { paragraphs: string[] }) {
  return <div style={{ display: "grid", gap: 10 }}>
    {paragraphs.map((paragraph, index) => {
      const parts = paragraphLines(paragraph);
      const bulletish = parts.length > 1 && parts.slice(1).some((line) => /^[-•※]/.test(line));
      if (bulletish) {
        return <div key={index} style={{ color: "#282d35", fontSize: 15, lineHeight: 1.7 }}>
          {parts[0] ? <p style={{ margin: "0 0 7px" }}>{parts[0]}</p> : null}
          <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 5 }}>
            {parts.slice(1).map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^[-•※]\s*/, "")}</li>)}
          </ul>
        </div>;
      }
      return <p key={index} style={{ margin: 0, color: "#282d35", fontSize: 15, lineHeight: 1.72, whiteSpace: "pre-line" }}>{paragraph}</p>;
    })}
  </div>;
}

export function KrPublicationPreview({
  blocks,
  adaptations,
}: {
  blocks: KrSemanticSourceBlock[];
  adaptations: KrStoredAdaptation[];
}) {
  const sections = assembleSemanticSections(blocks);
  const map = new Map(adaptations.map((adaptation) => [adaptation.section_id, adaptation]));

  return <section style={{ marginTop: 18, border: "1px solid #d9dde4", borderRadius: 18, background: "#fff", overflow: "hidden" }}>
    <details open>
      <summary style={{ cursor: "pointer", listStyle: "none", padding: "17px 20px", background: "#171922", color: "#fff", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <small style={{ display: "block", color: "#ff6576", fontWeight: 900, letterSpacing: ".04em" }}>REDPLAY · ПРЕВЬЮ ПУБЛИКАЦИИ</small>
          <strong style={{ display: "block", marginTop: 4, fontSize: 19 }}>Как материал будет выглядеть для читателя</strong>
        </div>
        <span style={{ color: "#aeb4be", fontSize: 12 }}>Структура таблиц повторяет PLAYNC</span>
      </summary>

      <article style={{ width: "min(1120px,100%)", margin: "0 auto", padding: "clamp(18px,3vw,34px)" }}>
        {sections.map((section, sectionIndex) => {
          const adaptation = map.get(section.id);
          if (!adaptation) return null;
          const units = Array.isArray(adaptation.content?.units) ? adaptation.content!.units as AdaptedUnit[] : [];
          return <section key={section.id} style={{ marginTop: sectionIndex ? 38 : 0, paddingTop: sectionIndex ? 30 : 0, borderTop: sectionIndex ? "1px solid #eceff3" : undefined }}>
            <h2 style={{ margin: "0 0 18px", fontSize: "clamp(23px,3vw,31px)", lineHeight: 1.18, letterSpacing: "-.02em" }}>{adaptation.title_ru || section.titleKr || `Раздел ${sectionIndex + 1}`}</h2>
            <div style={{ display: "grid", gap: 17 }}>
              {section.units.map((sourceUnit, unitIndex) => {
                const unit = units[unitIndex];
                if (!unit || unit.type !== sourceUnit.type) return null;
                if (unit.type === "text") return <TextUnit key={unitIndex} paragraphs={Array.isArray(unit.paragraphs_ru) ? unit.paragraphs_ru : []} />;
                if (unit.type === "table" && sourceUnit.type === "table") return <KrPublicationTable key={unitIndex} rowsRu={Array.isArray(unit.rows_ru) ? unit.rows_ru : []} sourceRows={sourceTableCells(sourceUnit.block)} />;
                if (unit.type === "image" && sourceUnit.type === "image" && isUsefulKrImage(sourceUnit.block)) {
                  const src = typeof sourceUnit.block.data?.src === "string" ? sourceUnit.block.data.src : "";
                  if (!src) return null;
                  return <figure key={unitIndex} style={{ margin: 0 }}>
                    <img src={src} alt={unit.caption_ru || sourceUnit.block.text_kr || "KR source"} style={{ width: "100%", maxHeight: 620, objectFit: "contain", borderRadius: 14, background: "#f5f6f8" }} />
                    {unit.caption_ru ? <figcaption style={{ marginTop: 7, color: "#747985", fontSize: 12 }}>{unit.caption_ru}</figcaption> : null}
                  </figure>;
                }
                return null;
              })}
            </div>
          </section>;
        })}
      </article>
    </details>
  </section>;
}
