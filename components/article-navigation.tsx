"use client";

import { ArrowUp, ChevronDown, List } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ArticleNavItem = { id: string; label: string };

export function ArticleNavigation({ items }: { items: ArticleNavItem[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(items[0]?.id || "");
  const [showTop, setShowTop] = useState(false);
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const progress = height > 0 ? Math.min(100, Math.max(0, window.scrollY / height * 100)) : 0;
      if (progressRef.current) progressRef.current.style.width = `${progress}%`;
      setShowTop((value) => value === (window.scrollY > 720) ? value : !value);
      let current = items[0]?.id || "";
      for (const item of items) {
        const node = document.getElementById(item.id);
        if (node && node.getBoundingClientRect().top <= 190) current = item.id;
      }
      setActive((value) => value === current ? value : current);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [items]);

  const goTo = (id: string) => {
    const node = document.getElementById(id);
    if (!node) return;
    if (window.innerWidth < 761) {
      setOpen(false);
      const top = node.getBoundingClientRect().top + window.scrollY - 78;
      window.requestAnimationFrame(() => window.scrollTo({ top, behavior: "auto" }));
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeIndex = Math.max(0, items.findIndex((item) => item.id === active));
  const activeItem = items[activeIndex];

  return <>
    <span ref={progressRef} className="article-progress" style={{ width: "0%" }} />
    <aside className={`article-toc ${open ? "is-open" : ""}`}>
      <button className="article-toc-toggle" onClick={() => { if (window.innerWidth < 761) setOpen(value => !value); }} aria-expanded={open}>
        <span><List size={15}/><span className="article-toc-label">В этом материале</span><span className="article-toc-current">{String(activeIndex + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")} · {activeItem?.label}</span></span><ChevronDown size={16}/>
      </button>
      <nav>{items.map((item, index) => <button key={item.id} onClick={() => goTo(item.id)} className={active === item.id ? "is-active" : ""}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</button>)}</nav>
    </aside>
    <button className={`article-to-top ${showTop ? "is-visible" : ""}`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Вернуться в начало статьи"><ArrowUp size={20}/></button>
  </>;
}
