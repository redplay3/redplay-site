import {
  ArrowUpRight, Bell, ChevronRight, CircleAlert, Crosshair, Gem, Globe2,
  Layers3, Map, Play, Send, Shield, Sparkles, Swords,
} from "lucide-react";
import { Fragment } from "react";
import type { ArticleAudience, ArticleBlock, ArticleIcon } from "@/lib/articles/types";

const icons = {
  alert: CircleAlert,
  bell: Bell,
  crosshair: Crosshair,
  gem: Gem,
  globe: Globe2,
  layers: Layers3,
  map: Map,
  shield: Shield,
  sparkles: Sparkles,
  swords: Swords,
} satisfies Record<ArticleIcon, typeof CircleAlert>;

function BlockIcon({ name = "alert", size = 21 }: { name?: ArticleIcon; size?: number }) {
  const Icon = icons[name];
  return <Icon size={size}/>;
}

function RenderBlock({ block }: { block: ArticleBlock }) {
    switch (block.type) {
      case "paragraph":
        return <p key={block.id} className={block.lead ? "article-lead" : undefined}>{block.text}</p>;
      case "heading": {
        const heading = block.level === 2 ? <h2>{block.text}</h2> : <h3>{block.text}</h3>;
        return <div key={block.id} id={block.anchor} className="article-block-heading">
          {block.number && <span className="article-section-number">{block.number}</span>}
          {block.kicker && <p className="article-kicker">{block.kicker}</p>}
          {heading}
        </div>;
      }
      case "list": {
        const Tag = block.ordered ? "ol" : "ul";
        return <Tag key={block.id}>{block.items.map((item, index) => <li key={`${block.id}-${index}`}>{item}</li>)}</Tag>;
      }
      case "facts":
        return <div key={block.id} className="article-facts">{block.items.map((item, index) => <div key={`${block.id}-${index}`}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>;
      case "note":
        return <div key={block.id} className={`article-note${block.compact ? " compact" : ""}`}><BlockIcon name={block.icon}/><div><strong>{block.title}</strong><p>{block.text}</p></div></div>;
      case "warning":
        return <div key={block.id} className="article-warning"><strong>{block.title}</strong><span>{block.text}</span></div>;
      case "cards":
        return <div key={block.id} className="key-grid">{block.items.map((item, index) => <div key={`${block.id}-${index}`}>{item.icon && <BlockIcon name={item.icon}/>}<strong>{item.title}</strong><p>{item.text}</p></div>)}</div>;
      case "table":
        return <div key={block.id} className="article-data-table-wrap"><table className={`article-data-table${block.compact ? " is-compact" : ""}`}><thead><tr>{block.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={`${block.id}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${block.id}-${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
      case "flow":
        return <div key={block.id} className="replica-flow">{block.items.flatMap((item, index) => [<div key={`${block.id}-item-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong>{item.subtitle && <small>{item.subtitle}</small>}</div>, ...(index < block.items.length - 1 ? [<ChevronRight key={`${block.id}-arrow-${index}`}/>] : [])])}</div>;
      case "image":
        return <figure key={block.id} className="article-wide-image"><img src={block.src} alt={block.alt}/>{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
      case "disclosure":
        return <details key={block.id} className="article-disclosure"><summary>{block.title}<span>{block.items.length}</span></summary><div className="class-chip-grid">{block.items.map((item) => <span key={item}>{item}</span>)}</div></details>;
      case "opinion":
        return <figure key={block.id} className="oni-insight"><img src={block.image || "/oni-redplay.webp"} alt="Они – персонаж RedPlay"/><div><span>{block.label || "Мнение RedPlay"}</span><blockquote>{block.text}</blockquote></div></figure>;
      case "video":
        return <a key={block.id} className="article-video-teaser" href={block.url} target="_blank" rel="noopener noreferrer"><span className="video-teaser-icon"><Play size={22} fill="currentColor"/></span><span><small>{block.label || "Видеоверсия"}</small><strong>{block.title}</strong><p>{block.text}</p></span><span className="video-teaser-action">{block.action || "Смотреть"} <ArrowUpRight size={15}/></span></a>;
      case "telegram":
        return <aside key={block.id} className="telegram-callout"><span className="telegram-callout-icon"><Send size={22}/></span><div><small>{block.label || "RedPlay в Telegram"}</small><strong>{block.title}</strong><p>{block.text}</p></div><a href={block.url || "https://t.me/redplay2022"} target="_blank" rel="noopener noreferrer">{block.action || "Присоединиться"} <ArrowUpRight size={15}/></a></aside>;
    }
}

export function ArticleBlockRenderer({ blocks, audience = "all" }: { blocks: ArticleBlock[]; audience?: ArticleAudience }) {
  return blocks.filter((block) => audience === "all" || !block.scope || block.scope === "all" || block.scope === audience).map((block) => <Fragment key={block.id}>
    {audience === "all" && block.scope && block.scope !== "all" && <span className={`article-scope-badge ${block.scope}`}>{block.scope === "essence" ? "ESSENCE" : "SPECIAL"}</span>}
    <RenderBlock block={block}/>
  </Fragment>);
}
