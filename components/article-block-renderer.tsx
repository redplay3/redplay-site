import {
  ArrowUpRight, Bell, ChevronRight, CircleAlert, Crosshair, Gem, Gift, Globe2,
  Layers3, Map, Play, Send, Shield, Sparkles, Swords,
} from "lucide-react";
import { Fragment } from "react";
import type { ArticleAudience, ArticleBlock, ArticleIcon } from "@/lib/articles/types";
import referenceStyles from "./article-reference.module.css";
import { ArticleVideoPlaylist } from "./article-video-playlist";

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

function youtubeVideoId(value: string) {
  const trimmed = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    let candidate = "";
    if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") candidate = url.searchParams.get("v") || "";
      else candidate = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/)?.[1] || "";
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function visibleForAudience(scope: ArticleAudience, audience: ArticleAudience) {
  return audience === "all" || scope === "all" || scope === audience;
}

function audienceLabel(scope: ArticleAudience) {
  if (scope === "essence") return "Только Essence";
  if (scope === "special-project") return "Только Special";
  return "Общий";
}

function safeOutboundUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "#";
  } catch {
    return "#";
  }
}

function cleanReferenceLine(value: string) {
  return value.trim().replace(/^•\s*/, "").replace(/^\d+\.\s*/, "");
}

function isReferenceHeading(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("•") || trimmed.length > 120 || trimmed.includes(" — ")) return false;
  const letters = trimmed.match(/[A-Za-zА-Яа-яЁё]/g) || [];
  const uppercase = trimmed.match(/[A-ZА-ЯЁ]/g) || [];
  return letters.length >= 4 && uppercase.length / letters.length > 0.78;
}

function groupReferenceItems(items: string[]) {
  const groups: Array<{ title: string; items: string[] }> = [];
  let current = { title: "Подробные изменения", items: [] as string[] };

  for (const rawItem of items) {
    const item = rawItem.trim();
    if (!item) continue;
    if (isReferenceHeading(item)) {
      if (current.items.length) groups.push(current);
      current = { title: item, items: [] };
      continue;
    }
    current.items.push(cleanReferenceLine(item));
  }

  if (current.items.length) groups.push(current);
  return groups;
}

function ReferenceArchive({ title, items }: { title: string; items: string[] }) {
  const groups = groupReferenceItems(items);
  return <div className={referenceStyles.archive}>
    <div className={referenceStyles.intro}>
      <span>Полные данные</span>
      <strong>{title}</strong>
      <p>Материал разделён по темам: параметры, награды и механики больше не смешаны в одном списке.</p>
    </div>
    <nav className={referenceStyles.navigation} aria-label={`Разделы: ${title}`}>
      {groups.map((group, index) => <a href={`#${encodeURIComponent(`${title}-${index}`)}`} key={`${group.title}-${index}`}>{group.title}</a>)}
    </nav>
    <div className={referenceStyles.groups}>
      {groups.map((group, groupIndex) => <section className={referenceStyles.group} id={encodeURIComponent(`${title}-${groupIndex}`)} key={`${group.title}-${groupIndex}`}>
        <div className={referenceStyles.groupHeading}><span>{String(groupIndex + 1).padStart(2, "0")}</span><h3>{group.title}</h3></div>
        <div className={referenceStyles.rows}>
          {group.items.map((item, itemIndex) => {
            const parts = item.split(/\s+—\s+/).map((part) => part.trim()).filter(Boolean);
            const isParameter = parts.length >= 2 && parts.length <= 5 && item.length <= 280;
            if (isParameter) return <div className={referenceStyles.parameter} key={`${groupIndex}-${itemIndex}`}>
              <strong>{parts[0]}</strong><span>{parts.slice(1).join(" · ")}</span>
            </div>;
            return <p className={referenceStyles.explanation} key={`${groupIndex}-${itemIndex}`}>{item}</p>;
          })}
        </div>
      </section>)}
    </div>
  </div>;
}

function RenderBlock({ block, audience }: { block: ArticleBlock; audience: ArticleAudience }) {
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
      case "audience-cards":
        return <div key={block.id} className="audience-grid">{block.items.filter((item) => visibleForAudience(item.scope, audience)).map((item, index) => <div className={item.scope} key={`${block.id}-${index}`}><span>{audienceLabel(item.scope)}</span><strong>{item.title}</strong><p>{item.text}</p></div>)}</div>;
      case "checklist":
        return <ol key={block.id} className="prepare-list">{block.items.filter((item) => visibleForAudience(item.scope, audience)).map((item, index) => <li className={item.scope} key={`${block.id}-${index}`}><span>{index + 1}</span><div><small>{audienceLabel(item.scope)}</small><strong>{item.title}</strong><p>{item.text}</p></div></li>)}</ol>;
      case "cta-cards":
        return <div key={block.id} className="article-link-grid">{block.items.filter((item) => visibleForAudience(item.scope, audience)).map((item, index) => <a className={`article-link-card ${item.scope}`} href={safeOutboundUrl(item.url)} target="_blank" rel="sponsored noopener noreferrer" key={`${block.id}-${index}`}><Gift size={24}/><div><small>{audienceLabel(item.scope)}</small><strong>{item.title}</strong><p>{item.text}</p><span>{item.action} <ArrowUpRight size={15}/></span></div></a>)}</div>;
      case "table":
        return <div key={block.id} className="article-data-table-wrap"><table className={`article-data-table${block.compact ? " is-compact" : ""}`}><thead><tr>{block.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={`${block.id}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${block.id}-${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
      case "flow":
        return <div key={block.id} className="replica-flow">{block.items.flatMap((item, index) => [<div key={`${block.id}-item-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong>{item.subtitle && <small>{item.subtitle}</small>}</div>, ...(index < block.items.length - 1 ? [<ChevronRight key={`${block.id}-arrow-${index}`}/>] : [])])}</div>;
      case "image":
        return <figure key={block.id} className="article-wide-image"><img src={block.src} alt={block.alt}/>{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
      case "disclosure":
        return block.items.length >= 20
          ? <ReferenceArchive key={block.id} title={block.title} items={block.items}/>
          : <details key={block.id} className="article-disclosure"><summary>{block.title}<span>{block.items.length}</span></summary><div className="class-chip-grid">{block.items.map((item, index) => <span key={`${block.id}-${index}`}>{item}</span>)}</div></details>;
      case "opinion":
        return <figure key={block.id} className="oni-insight"><img src={block.image || "/oni-redplay.webp"} alt="Они – персонаж RedPlay"/><div><span>{block.label || "Мнение RedPlay"}</span><blockquote>{block.text}</blockquote></div></figure>;
      case "video": {
        const youtubeId = block.source !== "file" ? youtubeVideoId(block.url) : null;
        if (youtubeId === "jiOzNaL7njw") return <ArticleVideoPlaylist key={block.id} title="Гномы после Iron Masters" text="Две официальные демонстрации помогают увидеть новый темп боя обоих переработанных гномьих классов." items={[
          { title: "Искатель сокровищ", url: "https://www.youtube.com/watch?v=jiOzNaL7njw", text: "Кости, джекпот и снятие усилений" },
          { title: "Маэстро", url: "https://www.youtube.com/watch?v=PBzcJ_gaLbg", text: "Молот, усиления и Разрушенная броня" },
        ]}/>;
        if (youtubeId) return <figure key={block.id} className="article-video-player">
          <div className="article-video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId}`} title={block.title || "Видео RedPlay"} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/></div>
          {(block.title || block.text || block.caption) && <figcaption>{block.title && <strong>{block.title}</strong>}{block.text && <p>{block.text}</p>}{block.caption && <small>{block.caption}</small>}</figcaption>}
        </figure>;
        if (block.source === "file") return block.url ? <figure key={block.id} className="article-video-player">
          <video controls playsInline preload="metadata" poster={block.poster || undefined}><source src={block.url}/><a href={block.url}>Открыть видео</a></video>
          {(block.title || block.text || block.caption) && <figcaption>{block.title && <strong>{block.title}</strong>}{block.text && <p>{block.text}</p>}{block.caption && <small>{block.caption}</small>}</figcaption>}
        </figure> : null;
        return block.url ? <a key={block.id} className="article-video-teaser" href={block.url} target="_blank" rel="noopener noreferrer"><span className="video-teaser-icon"><Play size={22} fill="currentColor"/></span><span><small>{block.label || "Видеоверсия"}</small><strong>{block.title}</strong><p>{block.text}</p></span><span className="video-teaser-action">{block.action || "Смотреть"} <ArrowUpRight size={15}/></span></a> : null;
      }
      case "video-playlist":
        return <ArticleVideoPlaylist key={block.id} title={block.title} text={block.text} items={block.items}/>;
      case "telegram":
        return <aside key={block.id} className="telegram-callout"><span className="telegram-callout-icon"><Send size={22}/></span><div><small>{block.label || "RedPlay в Telegram"}</small><strong>{block.title}</strong><p>{block.text}</p></div><a href={block.url || "https://t.me/redplay2022"} target="_blank" rel="noopener noreferrer">{block.action || "Присоединиться"} <ArrowUpRight size={15}/></a></aside>;
    }
}

export function ArticleBlockRenderer({ blocks, audience = "all" }: { blocks: ArticleBlock[]; audience?: ArticleAudience }) {
  return blocks.filter((block) => audience === "all" || !block.scope || block.scope === "all" || block.scope === audience).map((block) => <Fragment key={block.id}>
    {audience === "all" && block.scope && block.scope !== "all" && <span className={`article-scope-badge ${block.scope}`}>{block.scope === "essence" ? "ESSENCE" : "SPECIAL"}</span>}
    <RenderBlock block={block} audience={audience}/>
  </Fragment>);
}
