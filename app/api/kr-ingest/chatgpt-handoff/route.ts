import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assembleSemanticSections, type KrSemanticSourceBlock } from "@/lib/kr/semantic";

type AdaptedUnit = {
  type: "text" | "table" | "image";
  paragraphs_ru?: string[];
  rows_ru?: string[][];
  caption_ru?: string;
};

type StoredAdaptation = {
  section_id: string;
  section_index: number;
  title_ru: string | null;
  content: {
    units?: AdaptedUnit[];
    validation?: {
      structure_status?: string;
      structure_issues?: string[];
    };
  } | null;
  terms: unknown[] | null;
  numeric_status: string;
  terminology_status: string;
  status: string;
  model: string | null;
};

function tableRows(block: KrSemanticSourceBlock): string[][] {
  const value = block.data?.rows;
  if (!Array.isArray(value)) return [];
  return value.filter(Array.isArray).map((row) => row.map((cell) => {
    if (cell && typeof cell === "object" && "text" in (cell as Record<string, unknown>)) {
      return String((cell as Record<string, unknown>).text ?? "");
    }
    return String(cell ?? "");
  }));
}

function imageSource(block: KrSemanticSourceBlock) {
  const value = block.data?.src;
  return typeof value === "string" && value ? value : null;
}

function imageAlt(block: KrSemanticSourceBlock) {
  const value = block.data?.alt;
  if (typeof value === "string" && value) return value;
  return block.text_kr || "";
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

  const { data: snapshot, error: snapshotError } = await supabase
    .from("kr_ingest_snapshots")
    .select("id,item_id,version,source_url,content_hash,fetched_at,parser_version,metrics")
    .eq("id", body.snapshotId)
    .maybeSingle();
  if (snapshotError || !snapshot) return NextResponse.json({ error: "Snapshot не найден" }, { status: 404 });

  const { data: item, error: itemError } = await supabase
    .from("kr_ingest_items")
    .select("id,edition,source_kind,primary_url,plaync_url,article_id,feed_id,title_kr,status")
    .eq("id", snapshot.item_id)
    .maybeSingle();
  if (itemError || !item) return NextResponse.json({ error: "KR item не найден" }, { status: 404 });

  const { data: blockData, error: blockError } = await supabase
    .from("kr_ingest_blocks")
    .select("id,ordinal,block_type,source_type,text_kr,raw_html,data")
    .eq("snapshot_id", snapshot.id)
    .order("ordinal", { ascending: true });
  if (blockError) return NextResponse.json({ error: blockError.message }, { status: 500 });
  const blocks = (blockData || []) as KrSemanticSourceBlock[];

  const { data: adaptationData, error: adaptationError } = await supabase
    .from("kr_ingest_adaptations")
    .select("section_id,section_index,title_ru,content,terms,numeric_status,terminology_status,status,model")
    .eq("snapshot_id", snapshot.id)
    .order("section_index", { ascending: true });
  if (adaptationError) return NextResponse.json({ error: adaptationError.message }, { status: 500 });
  const adaptations = (adaptationData || []) as StoredAdaptation[];
  const adaptationMap = new Map(adaptations.map((adaptation) => [adaptation.section_id, adaptation]));
  const sections = assembleSemanticSections(blocks);

  let imageCount = 0;
  let tableCount = 0;
  const packetSections = sections.map((section, sectionIndex) => {
    const adaptation = adaptationMap.get(section.id);
    const adaptedUnits = Array.isArray(adaptation?.content?.units) ? adaptation!.content!.units! : [];

    const units = section.units.map((unit, unitIndex) => {
      const adapted = adaptedUnits[unitIndex];
      if (unit.type === "text") {
        return {
          type: "text" as const,
          paragraphs_kr: unit.paragraphs,
          paragraphs_ru: adapted?.type === "text" && Array.isArray(adapted.paragraphs_ru) ? adapted.paragraphs_ru : [],
          source_ordinals: unit.sourceOrdinals,
        };
      }
      if (unit.type === "table") {
        tableCount += 1;
        return {
          type: "table" as const,
          table_index: tableCount,
          rows_kr: tableRows(unit.block),
          rows_ru: adapted?.type === "table" && Array.isArray(adapted.rows_ru) ? adapted.rows_ru : [],
          source_ordinals: unit.sourceOrdinals,
        };
      }
      imageCount += 1;
      return {
        type: "image" as const,
        image_index: imageCount,
        src: imageSource(unit.block),
        alt_kr: imageAlt(unit.block),
        caption_ru: adapted?.type === "image" ? String(adapted.caption_ru || "") : "",
        source_ordinals: unit.sourceOrdinals,
      };
    });

    return {
      section_id: section.id,
      section_index: sectionIndex,
      kind: section.kind,
      title_kr: section.titleKr,
      title_ru: adaptation?.title_ru || null,
      adaptation_ready: Boolean(adaptation),
      validation: adaptation ? {
        numeric_status: adaptation.numeric_status,
        structure_status: adaptation.content?.validation?.structure_status || "pending",
        structure_issues: adaptation.content?.validation?.structure_issues || [],
        terminology_status: adaptation.terminology_status,
      } : null,
      terms: adaptation?.terms || [],
      units,
    };
  });

  const failedNumeric = adaptations.filter((item) => item.numeric_status === "fail").length;
  const failedStructure = adaptations.filter((item) => item.content?.validation?.structure_status === "fail").length;
  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000);

  const packet = {
    schema: "redplay.chatgpt.telegram-editor.v1",
    purpose: "Prepare a concise Telegram publication proposal for RedPlay. Do not publish anything automatically.",
    generated_at: generatedAt.toISOString(),
    editor_brief: {
      language: "ru",
      target: "RedPlay Telegram channel",
      desired_length_chars: "500-1200",
      key_points: "4-7",
      media_limit: 3,
      rules: [
        "Выбрать только самые важные изменения для игроков Lineage 2.",
        "Технические launcher/login/service notices обычно не предлагать к публикации, если они не влияют заметно на игроков.",
        "Не превращать большой патчноут в пересказ всех строк: подробности остаются на RedPlay.",
        "Критичные цифры сохранять точно; если раздел не прошёл numeric/structure validation, явно предупредить редактора.",
        "Из изображений и таблиц предложить максимум 3 действительно полезных медиа.",
        "Финальное решение о публикации всегда принимает пользователь.",
      ],
    },
    item: {
      id: item.id,
      edition: item.edition,
      source_kind: item.source_kind,
      title_kr: item.title_kr,
      article_id: item.article_id,
      feed_id: item.feed_id,
      primary_url: item.primary_url,
      plaync_url: item.plaync_url,
      status: item.status,
    },
    snapshot: {
      id: snapshot.id,
      version: snapshot.version,
      source_url: snapshot.source_url,
      content_hash: snapshot.content_hash,
      fetched_at: snapshot.fetched_at,
      parser_version: snapshot.parser_version,
    },
    qa: {
      semantic_sections: sections.length,
      adapted_sections: adaptations.length,
      pending_sections: Math.max(0, sections.length - adaptations.length),
      numeric_failures: failedNumeric,
      structure_failures: failedStructure,
      tables: tableCount,
      images: imageCount,
    },
    sections: packetSections,
  };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error: insertError } = await supabase.from("kr_chatgpt_handoffs").insert({
    item_id: item.id,
    snapshot_id: snapshot.id,
    token_hash: tokenHash,
    payload: packet,
    expires_at: expiresAt.toISOString(),
    created_by: auth.user.id,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  const shareUrl = `${origin}/api/chatgpt-handoff/${token}`;
  return NextResponse.json({
    ok: true,
    share_url: shareUrl,
    expires_at: expiresAt.toISOString(),
    summary: packet.qa,
  });
}
