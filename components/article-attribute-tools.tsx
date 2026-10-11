"use client";
import { useEffect, useRef } from "react";
import markup from "./attribute-tools-markup.json";
import "./attribute-tools.css";
export function ArticleAttributeTools() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    import("./attribute-tools-engine").then(({ initializeAttributeTools }) => {
      if (cancelled) return;
      element.innerHTML = markup;
      cleanup = initializeAttributeTools(element);
    }).catch(() => {
      if (!cancelled) element.textContent = "Не удалось загрузить калькулятор. Обнови страницу.";
    });
    return () => { cancelled = true; cleanup?.(); };
  }, []);
  return <div ref={root} className="attribute-tools"><p role="status">Загрузка локаций, предметов и калькулятора…</p></div>;
}
