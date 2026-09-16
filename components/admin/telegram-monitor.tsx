"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bold, CheckCircle2, Clipboard, ExternalLink, Italic, Link2, RefreshCw, RemoveFormatting, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type RunSummary = {
  checkedAt: string | null;
  ok: boolean | null;
  discoveredCount: number;
  newCount: number;
  relevantCount: number;
};

type FeedItem = {
  id: string;
  edition: string;
  category: string;
  title: string;
  sourceUrl: string;
  relevant: boolean;
  publishedAt: string | null;
  firstSeenAt: string;
};

type Props = {
  digestBody: string;
  digestGeneratedAt: string | null;
  lastRun: RunSummary;
  items: FeedItem[];
};

const editionNames: Record<string, string> = {
  main: "MAIN",
  essence: "ESSENCE",
  special: "SPECIAL",
  essence_special: "ESSENCE + SPECIAL",
  all: "ВСЕ",
  unknown: "ДРУГОЕ",
};

const categoryNames: Record<string, string> = {
  update: "обновление",
  notice: "важное",
  maintenance: "профилактика",
  event: "ивент",
  promo: "акция",
  code: "код",
  announcement: "анонс",
  other: "прочее",
};

function formatDate(value: string | null) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function renderInlineMarkup(value: string) {
  const tokens: string[] = [];
  const addToken = (html: string) => {
    const token = `TGHTMLTOKEN${tokens.length}X`;
    tokens.push(html);
    return token;
  };

  let prepared = value.replace(/\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g, (_match, label: string, url: string) => {
    const safe = safeHttpUrl(url);
    if (!safe) return label;
    return addToken(`<a href="${escapeHtml(safe)}">${escapeHtml(label)}</a>`);
  });

  prepared = prepared.replace(/https?:\/\/[^\s]+/g, (url) => {
    const cleaned = url.replace(/[),.;!?]+$/, "");
    const trailing = url.slice(cleaned.length);
    const safe = safeHttpUrl(cleaned);
    if (!safe) return url;
    return `${addToken(`<a href="${escapeHtml(safe)}">${escapeHtml(cleaned)}</a>`)}${trailing}`;
  });

  let html = escapeHtml(prepared);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  tokens.forEach((tokenHtml, index) => {
    html = html.replace(`TGHTMLTOKEN${index}X`, tokenHtml);
  });
  return html;
}

function digestToRichHtml(body: string) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);

  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return "<div><br></div>";

    const directLink = trimmed.match(/^🔗\s*(https?:\/\/\S+)$/);
    if (directLink) {
      const safe = safeHttpUrl(directLink[1]);
      return safe ? `<div><a href="${escapeHtml(safe)}">🔗 Подробнее</a></div>` : `<div>${renderInlineMarkup(trimmed)}</div>`;
    }

    const inline = renderInlineMarkup(line);
    const isSection = /^(⚔️|👾|🛡|🎁|🌐)\s*(MAIN|ESSENCE|SPECIAL|ВСЕ|ESSENCE\s*[&+]\s*SPECIAL)/i.test(trimmed);
    const isItemTitle = /^(🎁|🎯|🎟|🔥|📌|⚡|💥|•)\s+/.test(trimmed);
    const isFooter = /^RedPlay\s*\|\s*Lineage\s*2$/i.test(trimmed);
    const shouldBold = index === firstContentIndex || isSection || isItemTitle || isFooter;
    return `<div>${shouldBold ? `<strong>${inline}</strong>` : inline}</div>`;
  }).join("");
}

function plainTextFromEditor(editor: HTMLElement | null) {
  if (!editor) return "";
  return editor.innerText.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function TelegramMonitorClient({ digestBody, digestGeneratedAt, lastRun, items }: Props) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = digestToRichHtml(digestBody);
    setCharCount(plainTextFromEditor(editorRef.current).length);
  }, [digestBody]);

  const counts = useMemo(() => ({
    total: items.length,
    relevant: items.filter((item) => item.relevant).length,
    main: items.filter((item) => item.edition === "main").length,
    essence: items.filter((item) => item.edition === "essence").length,
    special: items.filter((item) => item.edition === "special" || item.edition === "essence_special").length,
  }), [items]);

  async function runRadar() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/l2-radar", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Не удалось запустить проверку");
      setMessage(data?.skipped === "cooldown" ? "Радар уже запускался недавно – данные актуальны." : `Проверка завершена. Новых ссылок: ${data?.newCount ?? 0}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка запуска радара");
    } finally {
      setBusy(false);
    }
  }

  function updateEditorStats() {
    setCharCount(plainTextFromEditor(editorRef.current).length);
  }

  function applyFormat(command: "bold" | "italic" | "removeFormat") {
    editorRef.current?.focus();
    document.execCommand(command, false);
    updateEditorStats();
  }

  function addLink() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setMessage("Сначала выдели текст, который должен стать ссылкой.");
      return;
    }
    const value = window.prompt("Вставь ссылку (https://...)", "https://");
    if (!value) return;
    const safe = safeHttpUrl(value.trim());
    if (!safe) {
      setMessage("Нужна корректная ссылка http:// или https://");
      return;
    }
    editorRef.current?.focus();
    document.execCommand("createLink", false, safe);
    updateEditorStats();
  }

  async function copyDraft() {
    const editor = editorRef.current;
    if (!editor) return;
    const plain = plainTextFromEditor(editor);
    const html = `<div>${editor.innerHTML}</div>`;
    if (!plain) return;

    try {
      if (navigator.clipboard?.write && "ClipboardItem" in window) {
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
        setMessage("Пост скопирован с выделениями и кликабельными ссылками.");
      } else {
        await navigator.clipboard.writeText(plain);
        setMessage("Пост скопирован. Этот браузер передал только обычный текст.");
      }
    } catch {
      await navigator.clipboard.writeText(plain);
      setMessage("Пост скопирован обычным текстом – браузер не разрешил rich-text буфер.");
    }
  }

  return <div className="tg-admin-grid">
    <section className="tg-admin-main">
      <div className="tg-panel tg-status-panel">
        <div className="tg-panel-head">
          <div><strong>Монитор L2Central</strong><span>Официальный Telegram → ссылки L2Central → RedPlay</span></div>
          <button className="admin-secondary" type="button" onClick={runRadar} disabled={busy}>
            <RefreshCw size={15} className={busy ? "tg-spin" : ""}/>{busy ? "Проверяем…" : "Проверить сейчас"}
          </button>
        </div>
        <div className="tg-stat-row">
          <div><small>Последняя проверка</small><strong>{formatDate(lastRun.checkedAt)}</strong></div>
          <div><small>Найдено</small><strong>{lastRun.discoveredCount}</strong></div>
          <div><small>Новых</small><strong>{lastRun.newCount}</strong></div>
          <div><small>Для дайджеста</small><strong>{lastRun.relevantCount}</strong></div>
          <div className={lastRun.ok === false ? "is-bad" : "is-good"}><small>Статус</small><strong>{lastRun.ok === false ? <><XCircle size={15}/> ошибка</> : <><CheckCircle2 size={15}/> работает</>}</strong></div>
        </div>
        {message ? <p className="tg-admin-message">{message}</p> : null}
      </div>

      <div className="tg-panel">
        <div className="tg-panel-head">
          <div><strong>Готовый пост</strong><span>Сгенерирован {formatDate(digestGeneratedAt)}. Правь его прямо как обычный текст – форматирование уже видно.</span></div>
          <button className="admin-primary" type="button" onClick={copyDraft} disabled={!charCount}><Clipboard size={15}/> Копировать для Telegram</button>
        </div>
        <div className="tg-rich-toolbar" aria-label="Форматирование Telegram-поста">
          <button type="button" title="Жирный" onMouseDown={(event) => { event.preventDefault(); applyFormat("bold"); }}><Bold size={15}/></button>
          <button type="button" title="Курсив" onMouseDown={(event) => { event.preventDefault(); applyFormat("italic"); }}><Italic size={15}/></button>
          <button type="button" title="Добавить ссылку" onMouseDown={(event) => { event.preventDefault(); addLink(); }}><Link2 size={15}/></button>
          <button type="button" title="Очистить форматирование" onMouseDown={(event) => { event.preventDefault(); applyFormat("removeFormat"); }}><RemoveFormatting size={15}/></button>
          <span>Выдели текст → выбери формат. Ссылки из генератора уже кликабельные.</span>
        </div>
        <div
          ref={editorRef}
          className="tg-rich-editor"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          spellCheck
          onInput={updateEditorStats}
        />
        <div className="tg-draft-foot"><span>{charCount.toLocaleString("ru-RU")} знаков</span><span>Копирование передаёт Telegram жирный текст, курсив и встроенные ссылки.</span></div>
      </div>
    </section>

    <aside className="tg-admin-side">
      <div className="tg-panel">
        <div className="tg-panel-head"><div><strong>Последние материалы</strong><span>{counts.total} ссылок в текущем окне</span></div></div>
        <div className="tg-mini-stats"><span>MAIN <b>{counts.main}</b></span><span>ESSENCE <b>{counts.essence}</b></span><span>SPECIAL <b>{counts.special}</b></span><span>В пост <b>{counts.relevant}</b></span></div>
        <div className="tg-feed-list">
          {items.length ? items.map((item) => <a key={item.id} href={item.sourceUrl} target="_blank" rel="noreferrer" className={`tg-feed-item ${item.relevant ? "is-relevant" : "is-muted"}`}>
            <div className="tg-feed-meta"><span className={`tg-edition ${item.edition}`}>{editionNames[item.edition] || item.edition}</span><span>{categoryNames[item.category] || item.category}</span><span>{formatDate(item.publishedAt || item.firstSeenAt)}</span></div>
            <strong>{item.title}</strong>
            <small>{item.relevant ? "попадает в подходящий дневной дайджест" : "сохранено, но не засоряет дайджест"}</small>
            <ExternalLink size={13}/>
          </a>) : <p className="tg-empty">Материалов пока нет.</p>}
        </div>
      </div>
    </aside>
  </div>;
}
