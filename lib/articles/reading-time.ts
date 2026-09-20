import type { ArticleSection } from "@/lib/articles/types";

const NON_CONTENT_KEYS = new Set([
  "id", "type", "scope", "url", "src", "poster", "image", "anchor",
  "source", "color", "background", "richText",
]);

function collectReadableText(value: unknown, key = ""): string[] {
  if (NON_CONTENT_KEYS.has(key) || value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectReadableText(item));
  if (typeof value !== "object") return [];
  return Object.entries(value).flatMap(([childKey, childValue]) => collectReadableText(childValue, childKey));
}

export function articleReadingMinutes(sections: ArticleSection[]) {
  const words = collectReadableText(sections)
    .join(" ")
    .replace(/https?:\/\/\S+/g, " ")
    .split(/\s+/u)
    .filter(Boolean).length;

  return Math.max(2, Math.ceil(words / 180));
}
