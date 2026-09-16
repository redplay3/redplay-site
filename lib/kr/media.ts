type ImageBlockLike = {
  text_kr?: string | null;
  data?: Record<string, unknown> | null;
};

export function imageSource(block: ImageBlockLike) {
  const value = block.data?.src;
  return typeof value === "string" && value ? value : null;
}

export function imageAlt(block: ImageBlockLike) {
  const value = block.data?.alt;
  if (typeof value === "string" && value) return value;
  return block.text_kr || "";
}

export function isDecorativeKrImage(block: ImageBlockLike) {
  const src = imageSource(block) || "";
  const alt = imageAlt(block);
  const haystack = `${src}\n${alt}`.toLowerCase();
  return /purple[_ -]?lounge[_ -]?footer|footerbanner|footer[_ -]?banner|attract_kr|static-conti\/1698872407960/.test(haystack);
}

export function isUsefulKrImage(block: ImageBlockLike) {
  return Boolean(imageSource(block)) && !isDecorativeKrImage(block);
}
