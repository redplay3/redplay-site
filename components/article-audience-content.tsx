"use client";

import { Fragment, useState } from "react";
import { ArticleBlockRenderer } from "@/components/article-block-renderer";
import type { ArticleAudience, ArticleSection } from "@/lib/articles/types";

type Target = Exclude<ArticleAudience, "all">;

const FORGED_SLUG = "forged-in-battle-vse-klassy-i-umeniya";
const DWARF_OVERVIEW_VIDEO_ID = "jiOzNaL7njw";

export function ArticleAudienceContent({ sections, targets, articleSlug }: { sections: ArticleSection[]; targets: Target[]; articleSlug?: string }) {
  const [audience, setAudience] = useState<ArticleAudience>("all");
  const hasBoth = targets.includes("essence") && targets.includes("special-project");
  const isForgedArticle = articleSlug === FORGED_SLUG;
  const dwarfOverview = isForgedArticle
    ? sections.flatMap((section) => section.blocks).find((block) => block.type === "video" && block.url.includes(DWARF_OVERVIEW_VIDEO_ID))
    : undefined;
  const displaySections = dwarfOverview
    ? sections.map((section) => ({ ...section, blocks: section.blocks.filter((block) => block.id !== dwarfOverview.id) }))
    : sections;

  return <>
    {hasBoth && <div className="article-audience-box">
      <p><strong>Essence и Special.</strong> Общие изменения показаны вместе, а отличающиеся блоки отмечены соответствующими метками.</p>
      <div className="article-audience-switch" role="group" aria-label="Фильтр серверов">
        {(["all", "essence", "special-project"] as ArticleAudience[]).map((item) => <button key={item} className={audience === item ? "is-active" : ""} onClick={() => setAudience(item)}>{item === "all" ? "Все" : item === "essence" ? "Только Essence" : "Только Special"}</button>)}
      </div>
    </div>}
    {displaySections.map((section, index) => {
      const visible = section.blocks.some((block) => audience === "all" || !block.scope || block.scope === "all" || block.scope === audience);
      if (!visible) return null;
      return <Fragment key={section.id}>
        <section id={section.id}>{index > 0 && <div className="article-block-heading"><span className="article-section-number">{String(index + 1).padStart(2, "0")}</span><h2>{section.label}</h2></div>}<ArticleBlockRenderer blocks={section.blocks} audience={hasBoth ? audience : targets[0]} insertDwarfSkillShowcase={isForgedArticle}/></section>
        {index === 0 && dwarfOverview && <ArticleBlockRenderer blocks={[dwarfOverview]} audience={hasBoth ? audience : targets[0]}/>}
      </Fragment>;
    })}
  </>;
}
