"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Expand, Maximize2, X } from "lucide-react";

type ArticleVideoEmbedProps = {
  videoId?: string;
  src?: string;
  source?: "youtube" | "file";
  title: string;
  poster?: string;
  orientation?: "vertical" | "horizontal" | "auto";
};

type VideoGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
  translateX: number;
  translateY: number;
  scale: number;
};

const EXPAND_DURATION = 420;

function getExpandedGeometry(compactRect: DOMRect): VideoGeometry {
  const viewportGap = window.innerWidth < 760 ? 12 : 32;
  const aspectRatio = compactRect.width / compactRect.height;
  const maxWidth = Math.min(aspectRatio > 1 ? 1100 : 620, window.innerWidth - viewportGap * 2);
  const maxHeight = Math.min(820, window.innerHeight * (window.innerWidth < 760 ? .82 : .76));
  const width = Math.min(maxWidth, maxHeight * aspectRatio);
  const height = width / aspectRatio;

  const targetLeft = (window.innerWidth - width) / 2;
  const targetTop = (window.innerHeight - height) / 2;
  const scale = Math.min(width / compactRect.width, height / compactRect.height);

  return {
    left: compactRect.left,
    top: compactRect.top,
    width: compactRect.width,
    height: compactRect.height,
    translateX: targetLeft - compactRect.left,
    translateY: targetTop - compactRect.top,
    scale,
  };
}

export function ArticleVideoEmbed({ videoId, src, source = "youtube", title, poster, orientation = "vertical" }: ArticleVideoEmbedProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const openFrameRef = useRef<number | null>(null);
  const settleFrameRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [geometry, setGeometry] = useState<VideoGeometry | null>(null);
  const [isVisuallyOpen, setIsVisuallyOpen] = useState(false);
  const [detectedOrientation, setDetectedOrientation] = useState<"vertical" | "horizontal">("horizontal");
  const isExpanded = geometry !== null;
  const resolvedOrientation = orientation === "auto" ? detectedOrientation : orientation;

  const motionDuration = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : EXPAND_DURATION;

  const openExpanded = () => {
    const compactRect = shellRef.current?.getBoundingClientRect();
    if (!compactRect) return;

    setGeometry(getExpandedGeometry(compactRect));

    // Keep the player at its exact compact rectangle for one painted frame.
    // Only then start the transform, so embedded video surfaces can never flash
    // at the target size before their clipping rectangle is ready.
    openFrameRef.current = window.requestAnimationFrame(() => {
      settleFrameRef.current = window.requestAnimationFrame(() => setIsVisuallyOpen(true));
    });
  };

  const closeExpanded = () => {
    if (!geometry) return;

    setIsVisuallyOpen(false);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setGeometry(null);
      closeTimerRef.current = null;
    }, motionDuration());
  };

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
    if (openFrameRef.current !== null) window.cancelAnimationFrame(openFrameRef.current);
    if (settleFrameRef.current !== null) window.cancelAnimationFrame(settleFrameRef.current);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
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
    "--video-x": `${geometry.translateX}px`,
    "--video-y": `${geometry.translateY}px`,
    "--video-scale": geometry.scale,
  } as CSSProperties) : undefined;

  return <>
    {isExpanded && <button type="button" className="article-video-backdrop" aria-label="Закрыть увеличенное видео" onClick={closeExpanded}/>}

    <div ref={shellRef} className={`article-video-shell is-${resolvedOrientation}`}>
      <div
        ref={playerRef}
        className={`article-korean-video-frame${isExpanded ? " is-expanded" : ""}${isVisuallyOpen ? " is-visually-open" : ""}`}
        style={playerStyle}
        role={isExpanded ? "dialog" : undefined}
        aria-modal={isExpanded ? true : undefined}
        aria-label={isExpanded ? title : undefined}
      >
        {source === "file" ? <video
          controls
          playsInline
          preload="metadata"
          poster={poster}
          onLoadedMetadata={(event) => {
            if (orientation !== "auto") return;
            const video = event.currentTarget;
            setDetectedOrientation(video.videoHeight > video.videoWidth ? "vertical" : "horizontal");
          }}
        >
          <source src={src}/>
          {src && <a href={src}>Открыть видео</a>}
        </video> : <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />}

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
