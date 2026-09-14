"use client";

import { useMemo, useState } from "react";
import styles from "./article-video-playlist.module.css";
import { ArticleVideoEmbed } from "./article-video-embed";

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

type ResolvedVideo = VideoItem & (
  | { kind: "youtube"; id: string }
  | { kind: "file"; src: string }
);

function resolveVideo(item: VideoItem): ResolvedVideo | null {
  const id = youtubeVideoId(item.url);
  if (id) return { ...item, kind: "youtube", id };
  try {
    const url = new URL(item.url.trim());
    if (/\.(?:mp4|webm|ogg)$/i.test(url.pathname)) return { ...item, kind: "file", src: url.toString() };
  } catch {
    return null;
  }
  return null;
}

function youtubeOrientation(value: string) {
  try {
    return new URL(value.trim()).pathname.startsWith("/shorts/") ? "vertical" as const : "horizontal" as const;
  } catch {
    return "horizontal" as const;
  }
}

export function ArticleVideoPlaylist({ title, text, items }: { title: string; text?: string; items: VideoItem[] }) {
  const videos = useMemo(() => items.map(resolveVideo).filter((item): item is ResolvedVideo => Boolean(item)), [items]);
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
      {active.kind === "youtube"
        ? <ArticleVideoEmbed key={active.id} videoId={active.id} title={active.title} orientation={youtubeOrientation(active.url)}/>
        : <ArticleVideoEmbed key={active.src} source="file" src={active.src} title={active.title} orientation="auto"/>
      }
    </div>
    <div className={styles.tabs} role="tablist" aria-label={title}>
      {videos.map((video, index) => <button type="button" role="tab" aria-selected={index === selected} className={index === selected ? styles.active : undefined} onClick={() => setSelected(index)} key={`${video.kind === "youtube" ? video.id : video.src}-${index}`}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{video.title}</strong>
        {video.text && <small>{video.text}</small>}
      </button>)}
    </div>
  </figure>;
}
