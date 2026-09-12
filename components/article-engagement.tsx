"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Eye, MessageCircle, Send, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = { pageKey: string; title: string; initialViews?: number };
const DAY = 24 * 60 * 60 * 1000;

export function ArticleEngagement({ pageKey, title, initialViews = 0 }: Props) {
  const [views, setViews] = useState(initialViews);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const register = async () => {
      const supabase = createClient();
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

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const url = typeof window === "undefined" ? "" : window.location.href;
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };
  const shareNative = async () => {
    const nativeShare = (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share;
    if (nativeShare) await nativeShare.call(navigator, { title, url });
    else setOpen((value) => !value);
  };
  const shareDiscord = async () => {
    await copy();
    window.open("https://discord.com/channels/@me", "_blank", "noopener,noreferrer");
  };

  return <div className="article-engagement" ref={root}>
    <span className="article-view-count" title="Просмотры публикации"><Eye size={15}/>{new Intl.NumberFormat("ru-RU").format(views)}</span>
    <div className="article-share-wrap">
      <button type="button" className="article-share-button" onClick={() => setOpen((value) => !value)}><Share2 size={15}/> Поделиться <ChevronDown size={13}/></button>
      {open && <div className="article-share-menu">
        <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><Send size={16}/> Telegram</a>
        <button type="button" onClick={shareDiscord}><MessageCircle size={16}/> Discord</button>
        <button type="button" onClick={copy}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Ссылка скопирована" : "Скопировать ссылку"}</button>
        <button type="button" onClick={shareNative}><Share2 size={16}/> Другие приложения</button>
      </div>}
    </div>
  </div>;
}
