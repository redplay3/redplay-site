"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, ExternalLink, RefreshCw, XCircle } from "lucide-react";
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

export function TelegramMonitorClient({ digestBody, digestGeneratedAt, lastRun, items }: Props) {
  const router = useRouter();
  const [body, setBody] = useState(digestBody);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setBody(digestBody), [digestBody]);

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

  async function copyDraft() {
    await navigator.clipboard.writeText(body);
    setMessage("Пост скопирован в буфер обмена.");
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
          <div><strong>Готовый пост</strong><span>Сгенерирован {formatDate(digestGeneratedAt)}. Текст можно поправить перед копированием.</span></div>
          <button className="admin-primary" type="button" onClick={copyDraft} disabled={!body.trim()}><Clipboard size={15}/> Копировать</button>
        </div>
        <textarea className="tg-draft" value={body} onChange={(event) => setBody(event.target.value)} spellCheck={false}/>
        <div className="tg-draft-foot"><span>{body.length.toLocaleString("ru-RU")} знаков</span><span>Автопубликация отключена – публикацию контролируешь ты.</span></div>
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
