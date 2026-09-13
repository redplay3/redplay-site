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
  const maxWidth = Math.min(620, window.innerWidth - viewportGap * 2);
  const maxHeight = Math.min(820, window.innerHeight * (window.innerWidth < 760 ? .82 : .76));
  const height = Math.min(maxHeight, maxWidth * 16 / 9);
  const width = height * 9 / 16;

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

function transformBetweenRects(from: VideoGeometry, to: VideoGeometry) {
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
}

export function ArticleVideoEmbed({ videoId, title }: ArticleVideoEmbedProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const openingRectRef = useRef<VideoGeometry | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const [geometry, setGeometry] = useState<VideoGeometry | null>(null);
  const isExpanded = geometry !== null;

  const motionDuration = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : EXPAND_DURATION;

  const openExpanded = () => {
    const compactRect = shellRef.current?.getBoundingClientRect();
    if (!compactRect) return;

    openingRectRef.current = rectToGeometry(compactRect);
    setGeometry(getExpandedGeometry());
  };

  const closeExpanded = () => {
    const player = playerRef.current;
    const compactRect = shellRef.current?.getBoundingClientRect();
    if (!player || !compactRect || !geometry) return;

    const currentRect = rectToGeometry(player.getBoundingClientRect());
    animationRef.current?.cancel();
    const animation = player.animate([
      { transform: transformBetweenRects(currentRect, geometry), borderRadius: "1rem" },
      { transform: transformBetweenRects(rectToGeometry(compactRect), geometry), borderRadius: ".8rem" },
    ], { duration: motionDuration(), easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
    animationRef.current = animation;
    void animation.finished.then(() => {
      if (animationRef.current === animation) {
        animationRef.current = null;
        setGeometry(null);
      }
    }).catch(() => undefined);
  };

  useLayoutEffect(() => {
    const player = playerRef.current;
    const openingRect = openingRectRef.current;
    if (!isExpanded || !player || !geometry || !openingRect) return;

    openingRectRef.current = null;
    const animation = player.animate([
      { transform: transformBetweenRects(openingRect, geometry), borderRadius: ".8rem" },
      { transform: "none", borderRadius: "1rem" },
    ], { duration: motionDuration(), easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
    animationRef.current = animation;
    void animation.finished.then(() => {
      if (animationRef.current === animation) animationRef.current = null;
    }).catch(() => undefined);
  }, [isExpanded, geometry]);

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

  useEffect(() => () => animationRef.current?.cancel(), []);

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
