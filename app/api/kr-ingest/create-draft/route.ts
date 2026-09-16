import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUsefulKrImage } from "@/lib/kr/media";
import { assembleSemanticSections, type KrSemanticSourceBlock, type KrSemanticUnit } from "@/lib/kr/semantic";
import { sourceTableCells, type KrTableCell } from "@/lib/kr/table-geometry";
import { applyVerifiedRuTerminology } from "@/lib/kr/verified-terminology";
import type { ArticleBlock, ArticleSection, ArticleTableCell } from "@/lib/articles/types";

type AdaptedUnit = {
  type: "text" | "table" | "image";
  paragraphs_ru?: string[];
  rows_ru?: string[][];
  caption_ru?: string;
};

type StoredAdaptation = {
  section_id: string;
  section_index: number;
  section_kind: string;
  title_ru: string;
  content: { units?: AdaptedUnit[]; validation?: { structure_status?: string } } | null;
  numeric_status: string;
};

const RU_MONTHS = ["", "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function verified(value: string) {
  return applyVerifiedRuTerminology(value);
}

function cleanTitle(value: string) {
  return verified(value).trim().replace(/^\[/, "").replace(/\]$/, "").trim();
}

function slugify(value: string) {
  const map: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  return value.toLowerCase().split("").map((char) => map[char] ?? char).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

function publicationDate(titleKr: string | null, fallback: string) {
  const match = titleKr?.match(/(1[0-2]|[1-9])월\s*(3[01]|[12]\d|[1-9])일/);
  const date = new Date(fallback);
  if (!match) return { day: date.getUTCDate(), month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
  return { day: Number(match[2]), month: Number(match[1]), year: date.getUTCFullYear() };
}

function paragraphBlocks(paragraphs: string[]): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const rawParagraph of paragraphs) {
    const paragraph = verified(rawParagraph);
    const lines = paragraph.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    let list: string[] = [];
    const flush = () => {
      if (!list.length) return;
      blocks.push({ id: id("list"), type: "list", items: list });
      list = [];
    };
    for (const line of lines) {
      if (/^[-•※]\s*/.test(line)) {
        list.push(line.replace(/^[-•※]\s*/, ""));
      } else {
        flush();
        blocks.push({ id: id("p"), type: "paragraph", text: line });
      }
    }
    flush();
  }
  return blocks;
}

type GridSlot = { text: string; origin: boolean; cell: KrTableCell };

function logicalTable(sourceUnit: Extract<KrSemanticUnit, { type: "table" }>, rowsRu: string[][]): ArticleBlock {
  const sourceRows = sourceTableCells(sourceUnit.block);
  const grid: GridSlot[][] = [];

  for (let rowIndex = 0; rowIndex < sourceRows.length; rowIndex += 1) {
    grid[rowIndex] ||= [];
    let cursor = 0;
    const sourceRow = sourceRows[rowIndex];
    for (let cellIndex = 0; cellIndex < sourceRow.length; cellIndex += 1) {
      const cell = sourceRow[cellIndex];
      while (grid[rowIndex][cursor]) cursor += 1;
      const text = verified(String(rowsRu[rowIndex]?.[cellIndex] ?? cell.text ?? ""));
      const rowspan = Math.max(1, cell.rowspan || 1);
      const colspan = Math.max(1, cell.colspan || 1);
      for (let rr = rowIndex; rr < rowIndex + rowspan; rr += 1) {
        grid[rr] ||= [];
        for (let cc = cursor; cc < cursor + colspan; cc += 1) {
          grid[rr][cc] = { text, origin: rr === rowIndex && cc === cursor, cell };
        }
      }
      cursor += colspan;
    }
  }

  const totalColumns = Math.max(1, ...grid.map((row) => row.length));
  const multiHeader = Boolean(sourceRows[0]?.some((cell) => (cell.rowspan || 1) > 1)) && sourceRows.length > 1;
  const headerDepth = multiHeader ? 2 : 1;
  const columns = Array.from({ length: totalColumns }, (_, column) => {
    const values: string[] = [];
    for (let row = 0; row < headerDepth; row += 1) {
      const value = grid[row]?.[column]?.text?.trim();
      if (value && !values.includes(value)) values.push(value);
    }
    return values.join(" · ") || `Колонка ${column + 1}`;
  });

  const rows = Array.from({ length: Math.max(0, sourceRows.length - headerDepth) }, (_, offset) => {
    const rowIndex = headerDepth + offset;
    return Array.from({ length: totalColumns }, (_, column) => {
      const slot = grid[rowIndex]?.[column];
      return slot?.origin ? slot.text : "";
    });
  });

  const cells: ArticleTableCell[][] = sourceRows.map((row, rowIndex) => row.map((cell, cellIndex) => ({
    text: verified(String(rowsRu[rowIndex]?.[cellIndex] ?? cell.text ?? "")),
    colspan: Math.max(1, cell.colspan || 1),
    rowspan: Math.max(1, cell.rowspan || 1),
    header: Boolean(cell.header) || rowIndex < headerDepth,
  })));

  return { id: id("table"), type: "table", columns, rows, compact: totalColumns <= 3, cells };
}

function imageBlock(unit: Extract<KrSemanticUnit, { type: "image" }>, adaptation: AdaptedUnit): ArticleBlock | null {
  if (!isUsefulKrImage(unit.block)) return null;
  const src = typeof unit.block.data?.src === "string" ? unit.block.data.src : "";
  if (!src) return null;
  const caption = verified(adaptation.caption_ru || "");
  return { id: id("image"), type: "image", src, alt: caption || unit.block.text_kr || "Lineage 2", caption: caption || undefined };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { snapshotId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  if (!body.snapshotId) return NextResponse.json({ error: "Нужен snapshotId" }, { status: 400 });

  const { data: snapshot, error: snapshotError } = await supabase
    .from("kr_ingest_snapshots")
    .select("id,item_id,fetched_at")
    .eq("id", body.snapshotId)
    .single();
  if (snapshotError || !snapshot) return NextResponse.json({ error: "Snapshot не найден" }, { status: 404 });

  const { data: item, error: itemError } = await supabase
    .from("kr_ingest_items")
    .select("id,edition,title_kr,plaync_url,primary_url")
    .eq("id", snapshot.item_id)
    .single();
  if (itemError || !item) return NextResponse.json({ error: "KR item не найден" }, { status: 404 });

  const { data: blockData, error: blockError } = await supabase
    .from("kr_ingest_blocks")
    .select("id,ordinal,block_type,source_type,text_kr,raw_html,data")
    .eq("snapshot_id", snapshot.id)
    .order("ordinal", { ascending: true });
  if (blockError) return NextResponse.json({ error: blockError.message }, { status: 500 });

  const { data: adaptationData, error: adaptationError } = await supabase
    .from("kr_ingest_adaptations")
    .select("section_id,section_index,section_kind,title_ru,content,numeric_status")
    .eq("snapshot_id", snapshot.id)
    .order("section_index", { ascending: true });
  if (adaptationError) return NextResponse.json({ error: adaptationError.message }, { status: 500 });

  const blocks = (blockData || []) as KrSemanticSourceBlock[];
  const sections = assembleSemanticSections(blocks);
  const adaptations = (adaptationData || []) as StoredAdaptation[];
  const map = new Map(adaptations.map((row) => [row.section_id, row]));
  const ready = sections.length > 0 && sections.every((section) => {
    const row = map.get(section.id);
    return row && row.numeric_status === "pass" && row.content?.validation?.structure_status === "pass";
  });
  if (!ready) return NextResponse.json({ error: "QA ещё не пройден полностью" }, { status: 409 });

  const classNames = adaptations
    .filter((row) => row.section_kind === "class")
    .map((row) => cleanTitle(row.title_ru).replace(/^Класс\s*[—-]\s*/i, ""))
    .filter(Boolean);
  const date = publicationDate(item.title_kr, snapshot.fetched_at);
  const dateLabel = `${date.day} ${RU_MONTHS[date.month]}`;
  const editionName = item.edition === "main" ? "Main" : "Essence";
  const classSuffix = classNames.length ? `: ${classNames.slice(0, 2).join(", ")}` : "";
  const title = `Обновление Lineage 2 ${editionName} от ${dateLabel}${classSuffix}`;
  const description = `Полный разбор обновления Lineage 2 ${editionName} от ${dateLabel} ${date.year}: классы, навыки, таблицы, события, магазин и другие изменения из официального корейского патчноута.`;
  const slug = slugify(`obnovlenie ${date.day} ${RU_MONTHS[date.month]} ${date.year} ${classNames.slice(0, 2).join(" ")}`);

  const existing = await supabase.from("articles").select("id").eq("slug", slug).eq("edition", item.edition).maybeSingle();
  if (existing.data?.id) return NextResponse.json({ ok: true, articleId: existing.data.id, existing: true });

  const articleSections: ArticleSection[] = sections.map((section, sectionIndex) => {
    const adaptation = map.get(section.id)!;
    const adaptedUnits = Array.isArray(adaptation.content?.units) ? adaptation.content!.units! : [];
    const articleBlocks: ArticleBlock[] = [];
    if (sectionIndex > 0) articleBlocks.push({ id: id("heading"), type: "heading", text: cleanTitle(adaptation.title_ru), level: 2 });

    section.units.forEach((sourceUnit, unitIndex) => {
      const adapted = adaptedUnits[unitIndex];
      if (!adapted || adapted.type !== sourceUnit.type) return;
      if (sourceUnit.type === "text" && adapted.type === "text") {
        articleBlocks.push(...paragraphBlocks(Array.isArray(adapted.paragraphs_ru) ? adapted.paragraphs_ru : []));
      } else if (sourceUnit.type === "table" && adapted.type === "table") {
        articleBlocks.push(logicalTable(sourceUnit, Array.isArray(adapted.rows_ru) ? adapted.rows_ru : []));
      } else if (sourceUnit.type === "image" && adapted.type === "image") {
        const image = imageBlock(sourceUnit, adapted);
        if (image) articleBlocks.push(image);
      }
    });

    return { id: id("section"), label: cleanTitle(adaptation.title_ru) || `Раздел ${sectionIndex + 1}`, blocks: articleBlocks };
  });

  articleSections.push({
    id: id("section"),
    label: "Источник",
    blocks: [{
      id: id("note"),
      type: "note",
      title: "Официальный источник",
      text: "Материал подготовлен по официальному корейскому патчноуту PLAYNC. Перед публикацией RedPlay сохранил структуру таблиц и проверил числовые значения.",
      icon: "globe",
      compact: true,
    }],
  });

  const payload = {
    game: "lineage-2",
    edition: item.edition === "main" ? "main" : "essence",
    category: "updates",
    slug,
    status: "draft",
    title,
    description,
    label: `Обновление · ${dateLabel} ${date.year}`,
    cover: {},
    tags: [editionName, "Обновление", "Корея", ...classNames],
    highlights: [],
    content: articleSections,
    seo: {
      title: `${title} – RedPlay`,
      description,
      keywords: ["Lineage 2", editionName, "обновление", ...classNames],
    },
    video_url: null,
    published_at: null,
  };

  const { data: article, error: articleError } = await supabase.from("articles").insert(payload).select("id").single();
  if (articleError || !article) return NextResponse.json({ error: articleError?.message || "Не удалось создать черновик" }, { status: 500 });

  return NextResponse.json({ ok: true, articleId: article.id, existing: false });
}
