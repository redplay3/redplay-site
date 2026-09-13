"use client";

import { useRef } from "react";
import { Expand, Maximize2, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ArticleVideoEmbedProps = {
  videoId: string;
  title: string;
};

function YoutubeFrame({ videoId, title }: ArticleVideoEmbedProps) {
  return <iframe
    src={`https://www.youtube.com/embed/${videoId}`}
    title={title}
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />;
}

export function ArticleVideoEmbed({ videoId, title }: ArticleVideoEmbedProps) {
  const fullscreenTarget = useRef<HTMLDivElement>(null);

  const openFullscreen = async () => {
    if (fullscreenTarget.current?.requestFullscreen) {
      await fullscreenTarget.current.requestFullscreen();
    }
  };

  return <Dialog>
    <div className="article-korean-video-frame">
      <YoutubeFrame videoId={videoId} title={title}/>
      <DialogTrigger asChild>
        <button type="button" className="article-video-expand" aria-label={`Увеличить видео: ${title}`}>
          <Expand size={16}/> <span>Увеличить</span>
        </button>
      </DialogTrigger>
    </div>

    <DialogContent className="article-video-dialog" showCloseButton={false}>
      <DialogHeader className="article-video-dialog-head">
        <div><DialogTitle>{title}</DialogTitle><DialogDescription>Видео из официальной корейской версии Lineage 2</DialogDescription></div>
        <div className="article-video-dialog-actions">
          <button type="button" onClick={openFullscreen}><Maximize2 size={17}/> Во весь экран</button>
          <DialogClose asChild><button type="button" aria-label="Закрыть видео"><X size={18}/> Закрыть</button></DialogClose>
        </div>
      </DialogHeader>
      <div ref={fullscreenTarget} className="article-video-dialog-player">
        <YoutubeFrame videoId={videoId} title={`${title} – увеличенная версия`}/>
      </div>
    </DialogContent>
  </Dialog>;
}
