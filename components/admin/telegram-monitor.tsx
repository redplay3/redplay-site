"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bold, CheckCircle2, Clipboard, ExternalLink, Italic, Link2, RefreshCw, RemoveFormatting, Send, Sparkles, XCircle } from "lucide-react";
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
  summary: string | null;
  rawContext: string;
  sourceUrl: string;
  relevant: boolean;
  publishedAt: string | null;
  firstSeenAt: string;
  alreadyPublished: boolean;
};

type ComposerChoice = {
  mode: "short" | "detailed";
  primary: boolean;
  note: string;
};

type Props = {
  digestBody: string;
  digestGeneratedAt: string | null;
  digestStatus: string;
  digestUpdatedAt: string | null;
  initialItemIds: string[];
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

function normalizePlainText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function plainTextFromEditor(editor: HTMLElement | null) {
  return editor ? normalizePlainText(editor.innerText) : "";
}

function plainTextWithLinksFromEditor(editor: HTMLElement | null) {
  if (!editor) return "";
  const clone = editor.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const label = (anchor.textContent || "").trim();
    const href = anchor.href || anchor.getAttribute("href") || "";
    const replacement = href && label !== href ? `${label} (${href})` : (href || label);
    anchor.replaceWith(document.createTextNode(replacement));
  });
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-99999px;top:-99999px;white-space:pre-wrap";
  holder.appendChild(clone);
  document.body.appendChild(holder);
  const value = normalizePlainText(clone.innerText);
  holder.remove();
  return value;
}

function sameIds(a: string[], b: string[]) {
  return [...a].sort().join("|") === [...b].sort().join("|");
}

function initialSelection(ids: string[]) {
  return Object.fromEntries(ids.map((id) => [id, { mode: "short", primary: false, note: "" } satisfies ComposerChoice]));
}

export function TelegramMonitorClient({ digestBody, digestGeneratedAt, digestStatus, digestUpdatedAt, initialItemIds, lastRun, items }: Props) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, ComposerChoice>>(() => initialSelection(initialItemIds));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [generatedItemIds, setGeneratedItemIds] = useState<string[]>(initialItemIds);
  const [generatedAt, setGeneratedAt] = useState<string | null>(digestGeneratedAt);
  const [status, setStatus] = useState(digestStatus);
  const [statusAt, setStatusAt] = useState<string | null>(digestUpdatedAt);

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = digestToRichHtml(digestBody);
    setCharCount(plainTextFromEditor(editorRef.current).length);
    setEditorDirty(false);
  }, [digestBody]);

  const counts = useMemo(() => ({
    total: items.length,
    relevant: items.filter((item) => item.relevant).length,
    main: items.filter((item) => item.edition === "main").length,
    essence: items.filter((item) => item.edition === "essence").length,
    special: items.filter((item) => item.edition === "special" || item.edition === "essence_special").length,
  }), [items]);

  const selectedItems = useMemo(() => items.filter((item) => Boolean(selection[item.id])), [items, selection]);
  const selectedIds = useMemo(() => selectedItems.map((item) => item.id), [selectedItems]);
  const detailedCount = selectedItems.filter((item) => selection[item.id]?.mode === "detailed").length;
  const primaryItem = selectedItems.find((item) => selection[item.id]?.primary) || null;
  const compositionChanged = !sameIds(selectedIds, generatedItemIds);

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

  function updateEditorStats(markDirty = true) {
    setCharCount(plainTextFromEditor(editorRef.current).length);
    if (markDirty) setEditorDirty(true);
  }

  function applyFormat(command: "bold" | "italic" | "removeFormat") {
    editorRef.current?.focus();
    document.execCommand(command, false);
    updateEditorStats();
  }

  function addLink() {
    const selectionRange = window.getSelection();
    if (!selectionRange || selectionRange.isCollapsed || !selectionRange.toString().trim()) {
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

  function toggleSelected(id: string) {
    setSelection((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = { mode: "short", primary: false, note: "" };
      return next;
    });
  }

  function setMode(id: string, mode: "short" | "detailed") {
    setSelection((current) => ({
      ...current,
      [id]: { ...(current[id] || { primary: false, note: "" }), mode },
    }));
  }

  function setPrimary(id: string) {
    setSelection((current) => {
      const wasPrimary = Boolean(current[id]?.primary);
      const next = Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, primary: false }]));
      next[id] = { ...(next[id] || { mode: "detailed", note: "" }), primary: !wasPrimary };
      if (!wasPrimary && next[id].mode === "short") next[id].mode = "detailed";
      return next;
    });
  }

  function setNote(id: string, note: string) {
    setSelection((current) => ({
      ...current,
      [id]: { ...(current[id] || { mode: "short", primary: false }), note },
    }));
  }

  function selectRecommended() {
    setSelection((current) => {
      const next = { ...current };
      items.filter((item) => item.relevant && !item.alreadyPublished).forEach((item) => {
        next[item.id] ||= { mode: "short", primary: false, note: "" };
      });
      return next;
    });
  }

  function clearSelection() {
    setSelection({});
  }

  async function generatePost() {
    if (!selectedItems.length) {
      setMessage("Сначала выбери хотя бы один материал справа.");
      return;
    }
    if (editorDirty && charCount > 0 && !window.confirm("Ты уже вручную правил текст. Пересборка заменит содержимое редактора. Продолжить?")) return;

    setGenerating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/l2-telegram-compose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: selectedItems.map((item) => ({
            id: item.id,
            mode: selection[item.id]?.mode || "short",
            primary: Boolean(selection[item.id]?.primary),
            note: selection[item.id]?.note || "",
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Не удалось сформировать пост");
      if (!editorRef.current) throw new Error("Редактор недоступен");
      editorRef.current.innerHTML = digestToRichHtml(String(data.body || ""));
      setCharCount(plainTextFromEditor(editorRef.current).length);
      setEditorDirty(false);
      setGeneratedItemIds(selectedIds);
      setGeneratedAt(data?.digest?.generated_at ? String(data.digest.generated_at) : new Date().toISOString());
      setStatus(data?.digest?.status ? String(data.digest.status) : "composed");
      setStatusAt(data?.digest?.updated_at ? String(data.digest.updated_at) : new Date().toISOString());
      setMessage(`Пост собран из ${selectedItems.length} материал${selectedItems.length === 1 ? "а" : "ов"}. Проверь текст слева.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка Telegram Composer");
    } finally {
      setGenerating(false);
    }
  }

  async function markPublished() {
    if (!generatedItemIds.length || !charCount) {
      setMessage("Сначала сформируй пост.");
      return;
    }
    if (compositionChanged) {
      setMessage("Состав материалов изменён после генерации. Сначала нажми «Пересобрать пост».");
      return;
    }
    setPublishing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/l2-telegram-compose", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemIds: generatedItemIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Не удалось отметить публикацию");
      setStatus("published");
      setStatusAt(new Date().toISOString());
      setMessage("Отмечено как опубликованное. Эти материалы теперь будут видны как уже использованные.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сохранения статуса");
    } finally {
      setPublishing(false);
    }
  }

  async function copyDraft() {
    const editor = editorRef.current;
    if (!editor) return;
    const plain = plainTextWithLinksFromEditor(editor);
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
        setMessage("Пост скопирован обычным текстом; ссылки добавлены рядом, чтобы ничего не потерялось.");
      }
    } catch {
      await navigator.clipboard.writeText(plain);
      setMessage("Пост скопирован обычным текстом; ссылки добавлены рядом, чтобы ничего не потерялось.");
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
          <div><small>Радар рекомендует</small><strong>{lastRun.relevantCount}</strong></div>
          <div className={lastRun.ok === false ? "is-bad" : "is-good"}><small>Статус</small><strong>{lastRun.ok === false ? <><XCircle size={15}/> ошибка</> : <><CheckCircle2 size={15}/> работает</>}</strong></div>
        </div>
        {message ? <p className="tg-admin-message">{message}</p> : null}
      </div>

      <div className="tg-panel">
        <div className="tg-panel-head tg-editor-head">
          <div>
            <strong>Готовый пост</strong>
            <span>{generatedAt ? `Сгенерирован ${formatDate(generatedAt)}.` : "Пока не сформирован."} {status === "published" ? `Опубликован · ${formatDate(statusAt)}` : "Правь его прямо как обычный текст."}</span>
          </div>
          <div className="tg-editor-actions">
            {status === "published" ? <span className="tg-published-pill">✓ опубликован</span> : <button className="admin-secondary" type="button" onClick={markPublished} disabled={!charCount || publishing || compositionChanged}><Send size={15}/>{publishing ? "Сохраняем…" : "Отметить опубликованным"}</button>}
            <button className="admin-primary" type="button" onClick={copyDraft} disabled={!charCount}><Clipboard size={15}/> Копировать для Telegram</button>
          </div>
        </div>
        {compositionChanged && charCount ? <p className="tg-compose-warning">Состав справа изменён после последней генерации. Пересобери пост перед отметкой публикации.</p> : null}
        <div className="tg-rich-toolbar" aria-label="Форматирование Telegram-поста">
          <button type="button" title="Жирный" onMouseDown={(event) => { event.preventDefault(); applyFormat("bold"); }}><Bold size={15}/></button>
          <button type="button" title="Курсив" onMouseDown={(event) => { event.preventDefault(); applyFormat("italic"); }}><Italic size={15}/></button>
          <button type="button" title="Добавить ссылку" onMouseDown={(event) => { event.preventDefault(); addLink(); }}><Link2 size={15}/></button>
          <button type="button" title="Очистить форматирование" onMouseDown={(event) => { event.preventDefault(); applyFormat("removeFormat"); }}><RemoveFormatting size={15}/></button>
          <span>Выдели текст → выбери формат. MAIN / ESSENCE / SPECIAL PROJECT получают реферальные ссылки автоматически.</span>
        </div>
        <div
          ref={editorRef}
          className="tg-rich-editor"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          spellCheck
          onInput={() => updateEditorStats(true)}
        />
        <div className="tg-draft-foot"><span>{charCount.toLocaleString("ru-RU")} знаков</span><span>Копирование передаёт Telegram жирный текст, курсив и встроенные ссылки.</span></div>
      </div>
    </section>

    <aside className="tg-admin-side">
      <div className="tg-panel tg-composer-panel">
        <div className="tg-panel-head"><div><strong>Материалы для поста</strong><span>{counts.total} ссылок в текущем окне. Карточка раскрывается, ↗ открывает источник.</span></div></div>
        <div className="tg-mini-stats"><span>MAIN <b>{counts.main}</b></span><span>ESSENCE <b>{counts.essence}</b></span><span>SPECIAL <b>{counts.special}</b></span><span>Рекомендуется <b>{counts.relevant}</b></span></div>

        <div className="tg-compose-bar">
          <div className="tg-compose-summary">
            <strong>Выбрано {selectedItems.length}</strong>
            <span>{detailedCount ? `подробно: ${detailedCount}` : "все кратко"}{primaryItem ? ` · главное: ${primaryItem.title}` : ""}</span>
          </div>
          <div className="tg-compose-tools">
            <button type="button" onClick={selectRecommended}>Выбрать полезные</button>
            <button type="button" onClick={clearSelection} disabled={!selectedItems.length}>Снять всё</button>
          </div>
          <button className="tg-generate-button" type="button" onClick={generatePost} disabled={!selectedItems.length || generating}>
            <Sparkles size={16}/>{generating ? "Собираю пост…" : `${generatedItemIds.length && sameIds(selectedIds, generatedItemIds) ? "Пересобрать" : "Сформировать"} пост · ${selectedItems.length}`}
          </button>
        </div>

        <div className="tg-feed-list">
          {items.length ? items.map((item) => {
            const choice = selection[item.id];
            const selected = Boolean(choice);
            const expanded = expandedId === item.id;
            const preview = (item.summary || (item.relevant ? "Краткое описание пока не найдено. Открой источник, чтобы посмотреть условия." : item.rawContext) || "Описание пока не получено.").trim();
            const compactPreview = preview.length > 180 ? `${preview.slice(0, 181).replace(/\s+\S*$/, "").trim()}…` : preview;
            return <article key={item.id} className={`tg-feed-item ${item.relevant ? "is-relevant" : "is-muted"}${selected ? " is-selected" : ""}${item.alreadyPublished ? " is-published" : ""}`} onClick={() => setExpandedId(expanded ? null : item.id)}>
              <div className="tg-feed-top">
                <label className="tg-select-box" onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" checked={selected} onChange={() => toggleSelected(item.id)}/>
                  <span>{selected ? "В посте" : "В пост"}</span>
                </label>
                <a className="tg-source-link" href={item.sourceUrl} target="_blank" rel="noreferrer" title="Открыть источник" onClick={(event) => event.stopPropagation()}><ExternalLink size={13}/></a>
              </div>
              <div className="tg-feed-meta"><span className={`tg-edition ${item.edition}`}>{editionNames[item.edition] || item.edition}</span><span>{categoryNames[item.category] || item.category}</span><span>{formatDate(item.publishedAt || item.firstSeenAt)}</span></div>
              <strong>{item.title}</strong>
              <p className="tg-feed-summary">{compactPreview}</p>
              <div className="tg-feed-flags">
                {item.relevant ? <span className="is-recommended">радар рекомендует</span> : <span>не приоритет</span>}
                {item.alreadyPublished ? <span className="is-done">✓ уже публиковали</span> : null}
                <span>{expanded ? "свернуть ▴" : "описание ▾"}</span>
              </div>

              {expanded ? <div className="tg-feed-expanded" onClick={(event) => event.stopPropagation()}>
                <p>{preview.length > 950 ? `${preview.slice(0, 950)}…` : preview}</p>
                <div className="tg-card-controls">
                  <div className="tg-mode-switch" aria-label="Глубина материала">
                    <button type="button" className={choice?.mode !== "detailed" ? "active" : ""} onClick={() => setMode(item.id, "short")}>Кратко</button>
                    <button type="button" className={choice?.mode === "detailed" ? "active" : ""} onClick={() => setMode(item.id, "detailed")}>Подробно</button>
                  </div>
                  <button type="button" className={`tg-primary-toggle${choice?.primary ? " active" : ""}`} onClick={() => setPrimary(item.id)}>{choice?.primary ? "★ Главная" : "☆ Сделать главной"}</button>
                </div>
                <label className="tg-editor-note">
                  <span>Мой акцент для генератора</span>
                  <textarea value={choice?.note || ""} onChange={(event) => setNote(item.id, event.target.value)} onFocus={() => { if (!selection[item.id]) setMode(item.id, "short"); }} placeholder="Например: обратить внимание на награды или влияние на фарм" maxLength={500}/>
                </label>
              </div> : null}
            </article>;
          }) : <p className="tg-empty">Материалов пока нет.</p>}
        </div>
      </div>
    </aside>
  </div>;
}
