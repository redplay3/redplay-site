"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Expand, Maximize2, X } from "lucide-react";

type ArticleVideoEmbedProps = {
  videoId: string;
  title: string;
};

type VideoGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const EXPAND_DURATION = 420;

function getExpandedGeometry(): VideoGeometry {
  const viewportGap = window.innerWidth < 760 ? 12 : 32;
  const maxWidth = Math.min(720, window.innerWidth - viewportGap * 2);
  const maxHeight = window.innerHeight - viewportGap * 2;
  const width = Math.min(maxWidth, maxHeight * 9 / 16);
  const height = width * 16 / 9;

  return {
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
    width,
    height,
  };
}

function rectToGeometry(rect: DOMRect): VideoGeometry {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export function ArticleVideoEmbed({ videoId, title }: ArticleVideoEmbedProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [geometry, setGeometry] = useState<VideoGeometry | null>(null);

  const motionDuration = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : EXPAND_DURATION;

  const openExpanded = () => {
    const compactRect = shellRef.current?.getBoundingClientRect();
    if (!compactRect) return;

    setGeometry(rectToGeometry(compactRect));
    setIsExpanded(true);
  };

  const closeExpanded = () => {
    const compactRect = shellRef.current?.getBoundingClientRect();
    if (!compactRect) return;

    setGeometry(rectToGeometry(compactRect));
    closeTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false);
      setGeometry(null);
    }, motionDuration());
  };

  useLayoutEffect(() => {
    if (!isExpanded) return;

    const animationFrame = window.requestAnimationFrame(() => setGeometry(getExpandedGeometry()));
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) closeExpanded();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  const openFullscreen = () => {
    const target = playerRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    }) | null;

    try {
      if (target?.requestFullscreen) {
        void target.requestFullscreen().catch(() => undefined);
      } else if (target?.webkitRequestFullscreen) {
        const fullscreenRequest = target.webkitRequestFullscreen();
        if (fullscreenRequest) void fullscreenRequest.catch(() => undefined);
      }
    } catch {
      // The smoothly expanded player remains available when fullscreen is denied.
    }
  };

  const playerStyle = geometry ? ({
    "--video-left": `${geometry.left}px`,
    "--video-top": `${geometry.top}px`,
    "--video-width": `${geometry.width}px`,
    "--video-height": `${geometry.height}px`,
  } as CSSProperties) : undefined;

  return <>
    {isExpanded && <button type="button" className="article-video-backdrop" aria-label="Закрыть увеличенное видео" onClick={closeExpanded}/>}

    <div ref={shellRef} className="article-video-shell">
      <div
        ref={playerRef}
        className={`article-korean-video-frame${isExpanded ? " is-expanded" : ""}`}
        style={playerStyle}
        role={isExpanded ? "dialog" : undefined}
        aria-modal={isExpanded ? true : undefined}
        aria-label={isExpanded ? title : undefined}
      >
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />

        {!isExpanded ? <button type="button" className="article-video-expand" aria-label={`Увеличить видео: ${title}`} onClick={openExpanded}>
          <Expand size={16}/> <span>Увеличить</span>
        </button> : <div className="article-video-expanded-bar">
          <strong>{title}</strong>
          <div>
            <button type="button" onClick={openFullscreen}><Maximize2 size={17}/> Во весь экран</button>
            <button type="button" aria-label="Закрыть видео" onClick={closeExpanded}><X size={18}/> Закрыть</button>
          </div>
        </div>}
      </div>
    </div>
  </>;
}
