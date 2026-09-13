"use client";

import { useMemo, useState } from "react";
import styles from "./article-video-playlist.module.css";

function youtubeVideoId(value: string) {
  const trimmed = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || null;
    if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) {
      return url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/)?.[1] || null;
    }
  } catch {
    return null;
  }
  return null;
}

type VideoItem = { title: string; url: string; text?: string };

export function ArticleVideoPlaylist({ title, text, items }: { title: string; text?: string; items: VideoItem[] }) {
  const videos = useMemo(() => items.map((item) => ({ ...item, id: youtubeVideoId(item.url) })).filter((item): item is VideoItem & { id: string } => Boolean(item.id)), [items]);
  const [selected, setSelected] = useState(0);
  const active = videos[Math.min(selected, Math.max(0, videos.length - 1))];
  if (!active) return null;

  return <figure className={styles.playlist}>
    <div className={styles.heading}>
      <span>Официальные демонстрации</span>
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
    <div className={styles.frame}>
      <iframe key={active.id} src={`https://www.youtube-nocookie.com/embed/${active.id}`} title={active.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>
    </div>
    <div className={styles.tabs} role="tablist" aria-label={title}>
      {videos.map((video, index) => <button type="button" role="tab" aria-selected={index === selected} className={index === selected ? styles.active : undefined} onClick={() => setSelected(index)} key={`${video.id}-${index}`}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{video.title}</strong>
        {video.text && <small>{video.text}</small>}
      </button>)}
    </div>
  </figure>;
}
