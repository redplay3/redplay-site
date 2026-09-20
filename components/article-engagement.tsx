"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, MessageCircle, Send, Share2 } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";

type ViewProps = { pageKey: string; initialViews?: number };
type ShareProps = { title: string; canonicalUrl: string };
const DAY = 24 * 60 * 60 * 1000;

export function ArticleViewCount({ pageKey, initialViews = 0 }: ViewProps) {
  const [views, setViews] = useState(initialViews);

  useEffect(() => {
    let active = true;
    const register = async () => {
      const supabase = createPublicClient();
      if (!supabase) return;
      const storageKey = `redplay:view:${pageKey}`;
      const lastView = Number(localStorage.getItem(storageKey) || 0);
      if (Date.now() - lastView >= DAY) {
        const { data, error } = await supabase.rpc("register_article_view", { p_page_key: pageKey });
        if (!error && active) {
          setViews(Number(data || 0));
          localStorage.setItem(storageKey, String(Date.now()));
          return;
        }
      }
      const { data } = await supabase.from("article_views").select("view_count").eq("page_key", pageKey).maybeSingle();
      if (active && data) setViews(Number(data.view_count || 0));
    };
    register();
    return () => { active = false; };
  }, [pageKey]);

  return <span className="article-view-count" title="Просмотры публикации"><Eye size={15}/>{new Intl.NumberFormat("ru-RU").format(views)}</span>;
}

export function ArticleSharePanel({ title, canonicalUrl }: ShareProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(canonicalUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };
  const shareDiscord = async () => {
    window.open("https://discord.com/channels/@me", "_blank", "noopener,noreferrer");
    await copy();
  };
  const shareNative = async () => {
    const nativeShare = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share;
    if (nativeShare) {
      try { await nativeShare.call(navigator, { title, url: canonicalUrl }); } catch {}
    } else {
      await copy();
    }
  };

  return <section className="article-share-panel" aria-label="Поделиться публикацией">
    <div className="article-share-copy"><span>Поделиться материалом</span><strong>Полезный разбор? Отправь друзьям</strong><p>Сохрани ссылку или поделись публикацией там, где общается твоя группа.</p></div>
    <div className="article-share-actions">
      <a className="share-telegram" href={`https://t.me/share/url?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer"><Send size={17}/> Telegram</a>
      <button className="share-discord" type="button" onClick={shareDiscord}><MessageCircle size={17}/> Discord</button>
      <button type="button" onClick={copy}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? "Скопировано" : "Копировать"}</button>
      <button type="button" onClick={shareNative}><Share2 size={17}/> Ещё</button>
    </div>
  </section>;
}
