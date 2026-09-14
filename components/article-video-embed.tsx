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
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "none" | "metadata" | "auto";
};

type VideoGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
  targetLeft: number;
  targetTop: number;
  targetWidth: number;
  targetHeight: number;
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
    targetLeft,
    targetTop,
    targetWidth: width,
    targetHeight: height,
    translateX: targetLeft - compactRect.left,
    translateY: targetTop - compactRect.top,
    scale,
  };
}

export function ArticleVideoEmbed({ videoId, src, source = "youtube", title, poster, orientation = "vertical", autoPlay = false, loop = false, muted = false, preload = "metadata" }: ArticleVideoEmbedProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const openFrameRef = useRef<number | null>(null);
  const settleFrameRef = useRef<number | null>(null);
  const closeFrameRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const isSettledRef = useRef(false);
  const [geometry, setGeometry] = useState<VideoGeometry | null>(null);
  const [isVisuallyOpen, setIsVisuallyOpen] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [detectedOrientation, setDetectedOrientation] = useState<"vertical" | "horizontal">("horizontal");
  const [controlsVisible, setControlsVisible] = useState(true);
  const isExpanded = geometry !== null;
  const resolvedOrientation = orientation === "auto" ? detectedOrientation : orientation;

  const motionDuration = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : window.innerWidth < 761 ? 280 : EXPAND_DURATION;

  const updateSettled = (next: boolean) => {
    isSettledRef.current = next;
    setIsSettled(next);
  };

  const showControls = () => {
    setControlsVisible(true);
    if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current);
    if (window.innerWidth < 761) controlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      controlsTimerRef.current = null;
    }, 2800);
  };

  const openExpanded = () => {
    const compactRect = shellRef.current?.getBoundingClientRect();
    if (!compactRect) return;

    updateSettled(false);
    setGeometry(getExpandedGeometry(compactRect));
    showControls();

    // Keep the player at its exact compact rectangle for one painted frame.
    // Only then start the transform, so embedded video surfaces can never flash
    // at the target size before their clipping rectangle is ready.
    openFrameRef.current = window.requestAnimationFrame(() => {
      settleFrameRef.current = window.requestAnimationFrame(() => {
        setIsVisuallyOpen(true);
        const duration = motionDuration();
        if (duration === 0) updateSettled(true);
        else settleTimerRef.current = window.setTimeout(() => {
          updateSettled(true);
          settleTimerRef.current = null;
        }, duration);
      });
    });
  };

  const closeExpanded = () => {
    if (!geometry) return;

    if (openFrameRef.current !== null) window.cancelAnimationFrame(openFrameRef.current);
    if (settleFrameRef.current !== null) window.cancelAnimationFrame(settleFrameRef.current);
    if (closeFrameRef.current !== null) window.cancelAnimationFrame(closeFrameRef.current);
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current);
    openFrameRef.current = null;
    settleFrameRef.current = null;
    closeFrameRef.current = null;
    settleTimerRef.current = null;

    const animateClosed = () => {
      setIsVisuallyOpen(false);
      closeTimerRef.current = window.setTimeout(() => {
        setGeometry(null);
        updateSettled(false);
        closeTimerRef.current = null;
      }, motionDuration());
    };

    if (isSettledRef.current) {
      updateSettled(false);
      closeFrameRef.current = window.requestAnimationFrame(animateClosed);
    } else animateClosed();
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
    if (closeFrameRef.current !== null) window.cancelAnimationFrame(closeFrameRef.current);
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current);
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

  const controlScale = geometry && !isSettled ? geometry.scale : 1;
  const playerStyle = geometry ? ({
    "--video-left": `${geometry.left}px`,
    "--video-top": `${geometry.top}px`,
    "--video-width": `${geometry.width}px`,
    "--video-height": `${geometry.height}px`,
    "--video-target-left": `${geometry.targetLeft}px`,
    "--video-target-top": `${geometry.targetTop}px`,
    "--video-target-width": `${geometry.targetWidth}px`,
    "--video-target-height": `${geometry.targetHeight}px`,
    "--video-x": `${geometry.translateX}px`,
    "--video-y": `${geometry.translateY}px`,
    "--video-scale": geometry.scale,
    "--video-control-size": `${44 / controlScale}px`,
    "--video-control-gap": `${5.6 / controlScale}px`,
    "--video-control-padding": `${8.8 / controlScale}px`,
    "--video-control-title-padding": `${7.2 / controlScale}px ${3.2 / controlScale}px`,
    "--video-control-font-size": `${10.88 / controlScale}px`,
    "--video-control-icon-size": `${17 / controlScale}px`,
  } as CSSProperties) : undefined;

  return <>
    {isExpanded && <button type="button" className="article-video-backdrop" aria-label="Закрыть увеличенное видео" onClick={closeExpanded}/>}

    <div ref={shellRef} className={`article-video-shell is-${resolvedOrientation}`}>
      <div
        ref={playerRef}
        className={`article-korean-video-frame${isExpanded ? " is-expanded" : ""}${isVisuallyOpen ? " is-visually-open" : ""}${isSettled ? " is-settled" : ""}`}
        style={playerStyle}
        role={isExpanded ? "dialog" : undefined}
        aria-modal={isExpanded ? true : undefined}
        aria-label={isExpanded ? title : undefined}
        onPointerDown={isExpanded ? showControls : undefined}
      >
        {source === "file" ? <video
          controls
          playsInline
          preload={preload}
          poster={poster}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
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
        </button> : <div className={`article-video-expanded-bar ${controlsVisible && isSettled ? "is-visible" : ""}`}>
          <strong>{title}</strong>
          <div>
            <button type="button" aria-label="Открыть видео во весь экран" onClick={openFullscreen}><Maximize2 size={17}/><span>Во весь экран</span></button>
            <button type="button" aria-label="Закрыть видео" onClick={closeExpanded}><X size={18}/><span>Закрыть</span></button>
          </div>
        </div>}
      </div>
    </div>
  </>;
}
