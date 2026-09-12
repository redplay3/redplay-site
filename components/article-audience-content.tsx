"use client";

import { useState } from "react";
import { ArticleBlockRenderer } from "@/components/article-block-renderer";
import type { ArticleAudience, ArticleSection } from "@/lib/articles/types";

type Target = Exclude<ArticleAudience, "all">;

export function ArticleAudienceContent({ sections, targets }: { sections: ArticleSection[]; targets: Target[] }) {
  const [audience, setAudience] = useState<ArticleAudience>("all");
  const hasBoth = targets.includes("essence") && targets.includes("special-project");

  return <>
    {hasBoth && <div className="article-audience-box">
      <p><strong>Essence и Special.</strong> Общие изменения показаны вместе, а отличающиеся блоки отмечены соответствующими метками.</p>
      <div className="article-audience-switch" role="group" aria-label="Фильтр серверов">
        {(["all", "essence", "special-project"] as ArticleAudience[]).map((item) => <button key={item} className={audience === item ? "is-active" : ""} onClick={() => setAudience(item)}>{item === "all" ? "Все" : item === "essence" ? "Только Essence" : "Только Special"}</button>)}
      </div>
    </div>}
    {sections.map((section, index) => {
      const visible = section.blocks.some((block) => audience === "all" || !block.scope || block.scope === "all" || block.scope === audience);
      if (!visible) return null;
      return <section id={section.id} key={section.id}>{index > 0 && <div className="article-block-heading"><span className="article-section-number">{String(index).padStart(2, "0")}</span><h2>{section.label}</h2></div>}<ArticleBlockRenderer blocks={section.blocks} audience={hasBoth ? audience : targets[0]}/></section>;
    })}
  </>;
}
