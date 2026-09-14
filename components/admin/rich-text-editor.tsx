"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered,
  Redo2, RemoveFormatting, Strikethrough, Underline, Undo2,
} from "lucide-react";
import type {
  ArticleRichText, ArticleRichTextBlock, ArticleRichTextInline, ArticleTextStyle,
} from "@/lib/articles/types";

type TextAlign = "left" | "center" | "right";

const fontNames: Record<string, ArticleTextStyle["font"]> = {
  inherit: "site",
  arial: "sans",
  helvetica: "sans",
  georgia: "serif",
  "times new roman": "serif",
  "courier new": "mono",
  courier: "mono",
};

const fontFaces: Record<NonNullable<ArticleTextStyle["font"]>, string> = {
  site: "inherit",
  sans: "Arial",
  serif: "Georgia",
  mono: "Courier New",
};

const fontSizeCommands: Record<NonNullable<ArticleTextStyle["size"]>, string> = {
  small: "2",
  normal: "3",
  large: "5",
  xlarge: "6",
};

function normalizeColor(value: string | null | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  const rgb = trimmed.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (!rgb) return undefined;
  return `#${rgb.slice(1).map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0")).join("")}`;
}

function normalizeFont(value: string | null | undefined): ArticleTextStyle["font"] {
  const first = value?.split(",")[0]?.replace(/["']/g, "").trim().toLowerCase();
  return first ? fontNames[first] : undefined;
}

function normalizeSize(value: string | null | undefined): ArticleTextStyle["size"] {
  const number = Number(value);
  if (number <= 2) return "small";
  if (number >= 6) return "xlarge";
  if (number >= 4) return "large";
  return undefined;
}

function normalizeCssSize(value: string | null | undefined): ArticleTextStyle["size"] {
  if (!value) return undefined;
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return undefined;
  if (value.endsWith("em") || value.endsWith("rem")) {
    if (numeric <= .9) return "small";
    if (numeric >= 1.45) return "xlarge";
    if (numeric >= 1.12) return "large";
    return "normal";
  }
  if (numeric <= 13) return "small";
  if (numeric >= 24) return "xlarge";
  if (numeric >= 18) return "large";
  return "normal";
}

function cleanStyle(style: ArticleTextStyle): ArticleTextStyle | undefined {
  const result = Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined && value !== false)) as ArticleTextStyle;
  return Object.keys(result).length ? result : undefined;
}

function inlineContent(node: Node, inherited: ArticleTextStyle = {}): ArticleRichTextInline[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || "";
    return text ? [{ text, style: cleanStyle(inherited) }] : [];
  }
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === "BR") return [{ text: "\n", style: cleanStyle(inherited) }];

  const next = { ...inherited };
  const tag = node.tagName.toLowerCase();
  if (tag === "b" || tag === "strong") next.bold = true;
  if (tag === "i" || tag === "em") next.italic = true;
  if (tag === "u") next.underline = true;
  if (tag === "s" || tag === "strike") next.strike = true;
  if (tag === "font") {
    next.font = normalizeFont(node.getAttribute("face")) || next.font;
    next.size = normalizeSize(node.getAttribute("size")) || next.size;
    next.color = normalizeColor(node.getAttribute("color")) || next.color;
  }

  const computedFont = normalizeFont(node.style.fontFamily);
  const computedColor = normalizeColor(node.style.color);
  const computedSize = normalizeCssSize(node.style.fontSize);
  if (computedFont) next.font = computedFont;
  if (computedColor) next.color = computedColor;
  if (computedSize) next.size = computedSize;
  if (node.style.fontWeight && (Number(node.style.fontWeight) >= 600 || node.style.fontWeight === "bold")) next.bold = true;
  if (node.style.fontStyle === "italic") next.italic = true;
  if (node.style.textDecoration.includes("underline")) next.underline = true;
  if (node.style.textDecoration.includes("line-through")) next.strike = true;

  return Array.from(node.childNodes).flatMap((child) => inlineContent(child, next));
}

function alignment(node: HTMLElement): TextAlign | undefined {
  const value = (node.style.textAlign || node.getAttribute("align") || "").toLowerCase();
  return value === "center" || value === "right" ? value : undefined;
}

function paragraphFrom(node: Node): ArticleRichTextBlock {
  const element = node instanceof HTMLElement ? node : undefined;
  return { type: "paragraph", align: element ? alignment(element) : undefined, content: inlineContent(node) };
}

function documentFromEditor(editor: HTMLElement): ArticleRichText {
  const blocks: ArticleRichTextBlock[] = [];
  let looseNodes: Node[] = [];
  const flushLoose = () => {
    if (!looseNodes.length) return;
    blocks.push({ type: "paragraph", content: looseNodes.flatMap((node) => inlineContent(node)) });
    looseNodes = [];
  };

  Array.from(editor.childNodes).forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      looseNodes.push(node);
      return;
    }
    const tag = node.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      flushLoose();
      const items = Array.from(node.children).filter((child) => child.tagName.toLowerCase() === "li").map((item) => ({
        align: alignment(item as HTMLElement),
        content: inlineContent(item),
      }));
      if (items.length) blocks.push({ type: "list", ordered: tag === "ol", items });
      return;
    }
    if (tag === "div" || tag === "p") {
      flushLoose();
      blocks.push(paragraphFrom(node));
      return;
    }
    looseNodes.push(node);
  });
  flushLoose();
  return { version: 1, blocks: blocks.length ? blocks : [{ type: "paragraph", content: [] }] };
}

function textFromDocument(value: ArticleRichText) {
  return value.blocks.map((block) => block.type === "paragraph"
    ? block.content.map((item) => item.text).join("")
    : block.items.map((item) => item.content.map((part) => part.text).join("")).join("\n")
  ).join("\n").trim();
}

function htmlStyle(style?: ArticleTextStyle) {
  if (!style) return "";
  const values = [
    style.bold && "font-weight:800",
    style.italic && "font-style:italic",
    (style.underline || style.strike) && `text-decoration:${[style.underline && "underline", style.strike && "line-through"].filter(Boolean).join(" ")}`,
    style.font && style.font !== "site" && `font-family:${fontFaces[style.font]}`,
    style.size && style.size !== "normal" && `font-size:${style.size === "small" ? ".82em" : style.size === "large" ? "1.22em" : "1.55em"}`,
    style.color && /^#[0-9a-f]{6}$/i.test(style.color) && `color:${style.color}`,
  ].filter(Boolean).join(";");
  return values ? ` style="${values}"` : "";
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineHtml(content: ArticleRichTextInline[]) {
  return content.map((item) => `<span${htmlStyle(item.style)}>${escapeHtml(item.text).replace(/\n/g, "<br>")}</span>`).join("");
}

function editorHtml(value: ArticleRichText | undefined, fallback: string) {
  if (!value?.blocks?.length) return `<p>${escapeHtml(fallback)}</p>`;
  return value.blocks.map((block) => {
    if (block.type === "paragraph") return `<p${block.align ? ` style="text-align:${block.align}"` : ""}>${inlineHtml(block.content)}</p>`;
    const tag = block.ordered ? "ol" : "ul";
    return `<${tag}>${block.items.map((item) => `<li${item.align ? ` style="text-align:${item.align}"` : ""}>${inlineHtml(item.content)}</li>`).join("")}</${tag}>`;
  }).join("");
}

export function RichTextEditor({ value, fallback, onChange }: { value?: ArticleRichText; fallback: string; onChange: (value: ArticleRichText, plainText: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);

  useEffect(() => {
    if (!editorRef.current || document.activeElement === editorRef.current) return;
    const next = editorHtml(value, fallback);
    if (editorRef.current.innerHTML !== next) editorRef.current.innerHTML = next;
  }, [fallback, value]);

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) selectionRef.current = selection.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (!selectionRef.current) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(selectionRef.current);
  };
  const emit = () => {
    if (!editorRef.current) return;
    const next = documentFromEditor(editorRef.current);
    onChange(next, textFromDocument(next));
    rememberSelection();
  };
  const command = (name: string, commandValue?: string) => {
    restoreSelection();
    document.execCommand(name, false, commandValue);
    emit();
  };

  const button = (label: string, icon: ReactNode, name: string) => <button type="button" title={label} aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={() => command(name)}>{icon}</button>;

  return <div className="rich-editor">
    <div className="rich-editor-toolbar" onMouseDown={rememberSelection}>
      <select aria-label="Шрифт" defaultValue="site" onChange={(event) => command("fontName", fontFaces[event.target.value as keyof typeof fontFaces])}>
        <option value="site">Шрифт сайта</option><option value="sans">Arial</option><option value="serif">Georgia</option><option value="mono">Courier</option>
      </select>
      <select aria-label="Размер текста" defaultValue="normal" onChange={(event) => command("fontSize", fontSizeCommands[event.target.value as keyof typeof fontSizeCommands])}>
        <option value="small">Мелкий</option><option value="normal">Обычный</option><option value="large">Крупный</option><option value="xlarge">Очень крупный</option>
      </select>
      <span className="rich-editor-group">
        {button("Жирный", <Bold size={15}/>, "bold")}{button("Курсив", <Italic size={15}/>, "italic")}{button("Подчёркнутый", <Underline size={15}/>, "underline")}{button("Зачёркнутый", <Strikethrough size={15}/>, "strikeThrough")}
      </span>
      <span className="rich-editor-group">
        {button("По левому краю", <AlignLeft size={15}/>, "justifyLeft")}{button("По центру", <AlignCenter size={15}/>, "justifyCenter")}{button("По правому краю", <AlignRight size={15}/>, "justifyRight")}
      </span>
      <span className="rich-editor-group">
        {button("Маркированный список", <List size={15}/>, "insertUnorderedList")}{button("Нумерованный список", <ListOrdered size={15}/>, "insertOrderedList")}
      </span>
      <label className="rich-editor-color" title="Цвет текста"><span>Цвет</span><input type="color" defaultValue="#222222" onChange={(event) => command("foreColor", event.target.value)}/></label>
      <span className="rich-editor-group">
        {button("Очистить форматирование", <RemoveFormatting size={15}/>, "removeFormat")}{button("Отменить", <Undo2 size={15}/>, "undo")}{button("Повторить", <Redo2 size={15}/>, "redo")}
      </span>
    </div>
    <div
      ref={editorRef}
      className="rich-editor-content"
      contentEditable
      suppressContentEditableWarning
      dangerouslySetInnerHTML={{ __html: editorHtml(value, fallback) }}
      onInput={emit}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
      onBlur={emit}
    />
    <small>Выдели нужный фрагмент и примени оформление. Форматирование сразу отображается в предпросмотре.</small>
  </div>;
}
