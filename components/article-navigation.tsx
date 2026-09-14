"use client";

import { ArrowUp, ChevronDown, List } from "lucide-react";
import { useEffect, useState } from "react";

export type ArticleNavItem = { id: string; label: string };

export function ArticleNavigation({ items }: { items: ArticleNavItem[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(items[0]?.id || "");
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const update = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? Math.min(100, Math.max(0, window.scrollY / height * 100)) : 0);
      setShowTop(window.scrollY > 720);
      let current = items[0]?.id || "";
      for (const item of items) {
        const node = document.getElementById(item.id);
        if (node && node.getBoundingClientRect().top <= 190) current = item.id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [items]);

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.innerWidth < 761) setOpen(false);
  };

  const activeIndex = Math.max(0, items.findIndex((item) => item.id === active));
  const activeItem = items[activeIndex];

  return <>
    <span className="article-progress" style={{ width: `${progress}%` }} />
    <aside className={`article-toc ${open ? "is-open" : ""}`}>
      <button className="article-toc-toggle" onClick={() => { if (window.innerWidth < 761) setOpen(value => !value); }} aria-expanded={open}>
        <span><List size={15}/><span className="article-toc-label">В этом материале</span><span className="article-toc-current">{String(activeIndex + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")} · {activeItem?.label}</span></span><ChevronDown size={16}/>
      </button>
      <nav>{items.map((item, index) => <button key={item.id} onClick={() => goTo(item.id)} className={active === item.id ? "is-active" : ""}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</button>)}</nav>
    </aside>
    <button className={`article-to-top ${showTop ? "is-visible" : ""}`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Вернуться в начало статьи"><ArrowUp size={20}/></button>
  </>;
}
