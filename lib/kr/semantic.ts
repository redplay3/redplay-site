export type KrSemanticSourceBlock = {
  id: string;
  ordinal: number;
  block_type: string;
  source_type: string | null;
  text_kr: string | null;
  raw_html: string | null;
  data: Record<string, unknown> | null;
};

export type KrSemanticNumericToken = {
  raw: string;
  normalized: string;
  kind: "percent" | "number";
};

export type KrSemanticUnit =
  | {
      type: "text";
      textKr: string;
      paragraphs: string[];
      sourceOrdinals: number[];
      numericTokens: KrSemanticNumericToken[];
    }
  | {
      type: "table";
      block: KrSemanticSourceBlock;
      sourceOrdinals: number[];
      numericTokens: KrSemanticNumericToken[];
    }
  | {
      type: "image";
      block: KrSemanticSourceBlock;
      sourceOrdinals: number[];
      numericTokens: KrSemanticNumericToken[];
    };

export type KrSemanticSection = {
  id: string;
  titleKr: string | null;
  kind: "intro" | "class" | "items" | "hunting" | "system" | "other";
  units: KrSemanticUnit[];
  sourceBlocks: KrSemanticSourceBlock[];
  sourceOrdinals: number[];
  numericTokens: KrSemanticNumericToken[];
};

function blockNumericTokens(block: KrSemanticSourceBlock): KrSemanticNumericToken[] {
  const value = block.data?.numericTokens;
  if (!Array.isArray(value)) return [];
  return value.filter((token): token is KrSemanticNumericToken => {
    if (!token || typeof token !== "object") return false;
    const item = token as Record<string, unknown>;
    return typeof item.raw === "string"
      && typeof item.normalized === "string"
      && (item.kind === "percent" || item.kind === "number");
  });
}

function sectionKind(title: string | null, index: number): KrSemanticSection["kind"] {
  if (!title) return index === 0 ? "intro" : "other";
  const value = title.toLowerCase();
  if (/클래스|마에스트로|포춘|fortune|maestro|class/.test(value)) return "class";
  if (/아이템|제작|교환|상점|상품|패키지|item|craft|shop/.test(value)) return "items";
  if (/사냥터|보스|레이드|hunt|boss|raid/.test(value)) return "hunting";
  if (/시스템|콘텐츠|매칭|system|content/.test(value)) return "system";
  return "other";
}

function finalizeSection(
  sections: KrSemanticSection[],
  titleKr: string | null,
  sourceBlocks: KrSemanticSourceBlock[],
) {
  if (!titleKr && !sourceBlocks.length) return;

  const units: KrSemanticUnit[] = [];
  let textBuffer: KrSemanticSourceBlock[] = [];

  const flushText = () => {
    if (!textBuffer.length) return;
    const paragraphs = textBuffer.map((block) => block.text_kr?.trim()).filter((text): text is string => Boolean(text));
    if (paragraphs.length) {
      units.push({
        type: "text",
        textKr: paragraphs.join("\n\n"),
        paragraphs,
        sourceOrdinals: textBuffer.map((block) => block.ordinal),
        numericTokens: textBuffer.flatMap(blockNumericTokens),
      });
    }
    textBuffer = [];
  };

  for (const block of sourceBlocks) {
    if (block.block_type === "table") {
      flushText();
      units.push({
        type: "table",
        block,
        sourceOrdinals: [block.ordinal],
        numericTokens: blockNumericTokens(block),
      });
      continue;
    }

    if (block.block_type === "image") {
      flushText();
      units.push({
        type: "image",
        block,
        sourceOrdinals: [block.ordinal],
        numericTokens: blockNumericTokens(block),
      });
      continue;
    }

    if (block.text_kr?.trim()) textBuffer.push(block);
  }
  flushText();

  const index = sections.length;
  sections.push({
    id: `semantic-${index + 1}`,
    titleKr,
    kind: sectionKind(titleKr, index),
    units,
    sourceBlocks,
    sourceOrdinals: sourceBlocks.map((block) => block.ordinal),
    numericTokens: sourceBlocks.flatMap(blockNumericTokens),
  });
}

export function assembleSemanticSections(blocks: KrSemanticSourceBlock[]): KrSemanticSection[] {
  const sections: KrSemanticSection[] = [];
  let titleKr: string | null = null;
  let sourceBlocks: KrSemanticSourceBlock[] = [];

  for (const block of blocks) {
    if (block.block_type === "heading" && block.text_kr?.trim()) {
      finalizeSection(sections, titleKr, sourceBlocks);
      titleKr = block.text_kr.trim();
      sourceBlocks = [];
      continue;
    }

    if (block.block_type === "image" || block.block_type === "table" || block.text_kr?.trim()) {
      sourceBlocks.push(block);
    }
  }

  finalizeSection(sections, titleKr, sourceBlocks);
  return sections;
}
