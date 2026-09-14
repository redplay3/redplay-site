import type { CSSProperties, ReactNode } from "react";
import type { ArticleRichText, ArticleRichTextInline, ArticleTextStyle } from "@/lib/articles/types";

const fontFamilies: Record<NonNullable<ArticleTextStyle["font"]>, string | undefined> = {
  site: undefined,
  sans: "Arial, Helvetica, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
};

const fontSizes: Record<NonNullable<ArticleTextStyle["size"]>, string | undefined> = {
  small: ".82em",
  normal: undefined,
  large: "1.22em",
  xlarge: "1.55em",
};

function safeColor(value?: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
}

function inlineStyle(style?: ArticleTextStyle): CSSProperties | undefined {
  if (!style) return undefined;
  const decoration = [style.underline && "underline", style.strike && "line-through"].filter(Boolean).join(" ") || undefined;
  return {
    color: safeColor(style.color),
    fontFamily: fontFamilies[style.font || "site"],
    fontSize: fontSizes[style.size || "normal"],
    fontStyle: style.italic ? "italic" : undefined,
    fontWeight: style.bold ? 800 : undefined,
    textDecoration: decoration,
  };
}

function renderInline(item: ArticleRichTextInline, index: number) {
  const pieces = item.text.split("\n");
  return <span key={index} style={inlineStyle(item.style)}>{pieces.map((piece, pieceIndex) => <span key={pieceIndex}>{pieceIndex > 0 && <br/>}{piece}</span>)}</span>;
}

function renderContent(content: ArticleRichTextInline[]) {
  return content.map(renderInline);
}

export function ArticleRichTextContent({ value, fallback, className }: { value?: ArticleRichText; fallback: string; className?: string }) {
  if (!value?.blocks?.length) return <p className={className}>{fallback}</p>;

  const result: ReactNode[] = [];
  value.blocks.forEach((block, index) => {
    if (block.type === "paragraph") {
      result.push(<p key={index} style={{ textAlign: block.align }}>{renderContent(block.content)}</p>);
      return;
    }
    const Tag = block.ordered ? "ol" : "ul";
    result.push(<Tag key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex} style={{ textAlign: item.align }}>{renderContent(item.content)}</li>)}</Tag>);
  });

  return <div className={`article-rich-text${className ? ` ${className}` : ""}`}>{result}</div>;
}
