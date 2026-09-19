import {
  ArrowUpRight, Bell, ChevronRight, CircleAlert, Crosshair, Gem, Gift, Globe2,
  Layers3, Map, Play, Send, Shield, Sparkles, Swords,
} from "lucide-react";
import { Fragment } from "react";
import type { CSSProperties } from "react";
import type { ArticleAudience, ArticleBlock, ArticleIcon, ArticleTableCell } from "@/lib/articles/types";
import referenceStyles from "./article-reference.module.css";
import { ArticleVideoPlaylist } from "./article-video-playlist";
import { ForgedDwarfSkillShowcase } from "./forged-dwarf-skill-showcase";
import { ArticleVideoEmbed } from "./article-video-embed";
import { ArticleRichTextContent } from "./article-rich-text";

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

function youtubeOrientation(value: string) {
  try {
    return new URL(value.trim()).pathname.startsWith("/shorts/") ? "vertical" as const : "horizontal" as const;
  } catch {
    return "horizontal" as const;
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
  return value.trim().replace(/^•\s*/, "").replace(/^\d+\.\s*/, "").replace(/\.\.(?=\s|$)/g, ".");
}

function cleanTableCell(value: string) {
  const cleaned = value
    .replace(/\\n/g, "\n")
    .trim()
    .replace(/\.\.(?=\s|$)/g, ".")
    .replace(/Случайный расход кристаллов/g, "Случайный расход руды духов");
  if (cleaned === "Прогрессия") return "Параметры по уровню";
  const legacyProgression = cleaned.match(/^Уровень персонажа\s*•\s*исходный параметр:\s*([^•]+)\s*•\s*Значения:\s*(.+)$/i);
  if (!legacyProgression) return cleaned;
  const level = legacyProgression[1].trim();
  const values = legacyProgression[2].replace(/\.$/, "").split("•").map((item) => item.trim());
  if (values.length === 1) return `Изучение: ${level} уровень персонажа; физ. атака +${values[0]}`;
  if (values.length === 5) return `Изучение: ${level} уровень персонажа; физ. защита +${values[0]}; физ. уклонение +${values[1]}; шанс получения крит. ударов ${values[2]}; мощность всех умений +${values[3]}; макс. HP +${values[4]}`;
  return `Изучение: ${level} уровень персонажа; параметры: ${values.join(" · ")}`;
}

function safeTableColor(value?: string | null) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "black" || normalized === "white" || /^#[0-9a-f]{3,8}$/i.test(normalized)) return normalized;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(normalized)) return normalized;
  return undefined;
}

function isDarkTableCell(cell: ArticleTableCell) {
  const background = safeTableColor(cell.background);
  return background === "black" || background === "#000" || background === "#000000" || background === "rgb(0, 0, 0)" || background === "rgb(13, 13, 13)";
}

function isTableHeaderRow(row: ArticleTableCell[]) {
  return row.length > 0 && row.every((cell) => cell.header || isDarkTableCell(cell));
}

function TableCellContent({ value }: { value: string }) {
  const cleaned = cleanTableCell(value);
  if (!cleaned.includes("\n")) return <>{cleaned}</>;

  return <span className="article-table-cell-content">{cleaned.split("\n").map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <span className="article-table-cell-gap" aria-hidden="true" key={index}/>;

    const bullet = trimmed.match(/^[-•]\s*(.+)$/);
    if (bullet) return <span className="article-table-cell-line is-bullet" key={index}>{bullet[1]}</span>;

    const label = trimmed.match(/^([^:]{1,48}:)(\s*.*)$/);
    if (label) return <span className="article-table-cell-line" key={index}><strong>{label[1]}</strong>{label[2]}</span>;

    const isSubheading = /^Dominance\b/i.test(trimmed) || (/^[A-ZА-ЯЁ][^.!?]{2,70}\([^()]+\)$/.test(trimmed));
    return <span className={`article-table-cell-line${isSubheading ? " is-subheading" : ""}`} key={index}>{trimmed}</span>;
  })}</span>;
}

type ArticleTableBlock = Extract<ArticleBlock, { type: "table" }>;

function isSimplePowerProgression(block: ArticleTableBlock) {
  if (block.rows.length < 8 || block.columns.length < 2 || block.columns.length > 3) return false;
  const headers = block.columns.map((column) => cleanTableCell(column).toLowerCase());
  const powerColumns = headers.filter((header) => /^(сила|мощь|мощность)$/.test(header));
  return powerColumns.length === 1
    && headers.every((header) => header.includes("уровень") || /^(сила|мощь|мощность)$/.test(header))
    && block.rows.every((row) => row.length === block.columns.length && row.every((cell) => cleanTableCell(cell).length <= 24 && !cleanTableCell(cell).includes("\n")));
}

function SimplePowerProgression({ block }: { block: ArticleTableBlock }) {
  const first = block.rows[0];
  const last = block.rows.at(-1) || first;
  const powerIndex = block.columns.findIndex((column) => /^(сила|мощь|мощность)$/i.test(cleanTableCell(column)));
  const learnIndex = block.columns.findIndex((column) => /изучени/i.test(cleanTableCell(column)));
  const powerLabel = cleanTableCell(block.columns[powerIndex] || "Сила");
  const range = learnIndex >= 0 ? ` · изучение: ${first[learnIndex]}–${last[learnIndex]}` : "";
  return <div className="article-progression-card">
    <div className="article-progression-summary"><span>Кратко</span><strong>{powerLabel}: {first[powerIndex]} → {last[powerIndex]}</strong><p>Уровни умения: {first[0]}–{last[0]}{range}</p></div>
    <details className="article-progression-details"><summary>Показать прогрессию по уровням <span>{block.rows.length}</span></summary><div className="article-progression-grid">
      {block.rows.map((row, index) => <div key={`${block.id}-progress-${index}`}><small>Уровень {row[0]}</small><strong>{row[powerIndex]}</strong>{learnIndex >= 0 && <span>Изучение: {row[learnIndex]}</span>}</div>)}
    </div></details>
  </div>;
}

function repeatedEffectGroups(block: ArticleTableBlock) {
  if (block.rows.length < 8 || block.columns.length < 4 || block.columns.length > 5) return null;
  if (!/^название/i.test(cleanTableCell(block.columns[0])) || !/уровень/i.test(cleanTableCell(block.columns[1])) || !/изучени/i.test(cleanTableCell(block.columns[2]))) return null;
  const groups: Array<{ name: string; rows: string[][] }> = [];
  for (const row of block.rows) {
    if (cleanTableCell(row[0] || "")) groups.push({ name: cleanTableCell(row[0]), rows: [row] });
    else if (groups.length) groups.at(-1)!.rows.push(row);
    else return null;
  }
  if (!groups.length || groups.some((group) => group.rows.length < 4 || group.rows.slice(1).some((row) => row.slice(3).some((cell) => cleanTableCell(cell || ""))))) return null;
  return groups;
}

function RepeatedEffectProgression({ block, groups }: { block: ArticleTableBlock; groups: NonNullable<ReturnType<typeof repeatedEffectGroups>> }) {
  return <div className="article-skill-progressions">{groups.map((group, groupIndex) => {
    const first = group.rows[0];
    return <section className="article-skill-progression" key={`${block.id}-group-${groupIndex}`}>
      <header><span>Навык</span><h4>{group.name}</h4></header>
      <div className="article-skill-effect-grid">{block.columns.slice(3).map((column, index) => first[index + 3] ? <div key={`${block.id}-effect-${groupIndex}-${index}`}><strong>{column}</strong><TableCellContent value={first[index + 3]}/></div> : null)}</div>
      <details className="article-progression-details"><summary>Показать уровни изучения <span>{group.rows.length}</span></summary><div className="article-level-map">
        {group.rows.map((row, rowIndex) => <span key={`${block.id}-level-${groupIndex}-${rowIndex}`}><strong>{row[1]}</strong><small>изучение: {row[2]}</small></span>)}
      </div></details>
    </section>;
  })}</div>;
}

const skillStatPattern = /^(Эффект баффа|Длительность|Расход|Время применения|Перезарядка|MP|Руда духов):\s*(.+)$/i;

function NarrativeSkillTable({ block }: { block: ArticleTableBlock }) {
  const title = cleanTableCell(block.columns[0] || block.cells?.[0]?.[0]?.text || "Описание навыка");
  const lines = cleanTableCell(block.rows[0]?.[0] || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const lead: string[] = [];
  const sections: Array<{ title: string; items: string[] }> = [];
  const dominance: Array<{ range: string; hp: string }> = [];
  const stats: Array<{ label: string; value: string }> = [];
  let current: { title: string; items: string[] } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const dominanceMatch = line.match(/^Dominance\s+(.+)$/i);
    const nextHp = lines[index + 1]?.replace(/^[-•]\s*/, "").match(/^HP барьера копья:\s*(.+)$/i);
    if (dominanceMatch && nextHp) {
      dominance.push({ range: dominanceMatch[1], hp: nextHp[1] });
      index += 1;
      continue;
    }
    const stat = line.replace(/^[-•]\s*/, "").match(skillStatPattern);
    if (stat) {
      stats.push({ label: stat[1], value: stat[2] });
      continue;
    }
    const isHeading = line.endsWith(":") || (/^[A-ZА-ЯЁ][^.!?]{2,80}\([^()]+\)$/.test(line) && index > 0);
    if (isHeading) {
      current = { title: line.replace(/:$/, ""), items: [] };
      sections.push(current);
      continue;
    }
    const value = line.replace(/^[-•]\s*/, "");
    if (current) current.items.push(value);
    else lead.push(value);
  }

  return <section className="article-skill-card">
    <header><span>Описание навыка</span><h4>{title}</h4></header>
    {lead.map((line, index) => <p className="article-skill-lead" key={`${block.id}-lead-${index}`}>{line}</p>)}
    {sections.map((section, index) => <div className="article-skill-section" key={`${block.id}-section-${index}`}><h5>{section.title}</h5>{section.items.length > 0 && <ul>{section.items.map((item, itemIndex) => <li key={`${block.id}-section-${index}-${itemIndex}`}>{item}</li>)}</ul>}</div>)}
    {dominance.length > 0 && <div className="article-skill-matrix"><h5>HP барьера по Dominance</h5><table><thead><tr><th>Dominance</th><th>HP барьера</th></tr></thead><tbody>{dominance.map((item, index) => <tr key={`${block.id}-dominance-${index}`}><td>{item.range}</td><td>{item.hp}</td></tr>)}</tbody></table></div>}
    {stats.length > 0 && <dl className="article-skill-stats">{stats.map((stat, index) => <div key={`${block.id}-stat-${index}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>}
  </section>;
}

function EnhancedArticleTable({ block }: { block: ArticleTableBlock }) {
  if (isSimplePowerProgression(block)) return <SimplePowerProgression block={block}/>;
  const groups = repeatedEffectGroups(block);
  if (groups) return <RepeatedEffectProgression block={block} groups={groups}/>;
  if (block.columns.length === 1 && block.rows.length === 1 && cleanTableCell(block.rows[0]?.[0] || "").includes("\n")) return <NarrativeSkillTable block={block}/>;
  return <StructuredArticleTable block={block}/>;
}

function StructuredArticleTable({ block }: { block: Extract<ArticleBlock, { type: "table" }> }) {
  if (!block.cells?.length) return <table className={`article-data-table${block.compact ? " is-compact" : ""}`}>
    <thead><tr>{block.columns.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}</tr></thead>
    <tbody>{block.rows.map((row, rowIndex) => <tr key={`${block.id}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${block.id}-${rowIndex}-${cellIndex}`}><TableCellContent value={cell}/></td>)}</tr>)}</tbody>
  </table>;

  const headerRows = block.cells.findIndex((row) => !isTableHeaderRow(row));
  const headerCount = headerRows === -1 ? block.cells.length : headerRows;
  const renderRow = (row: ArticleTableCell[], rowIndex: number, inHead: boolean) => <tr key={`${block.id}-${rowIndex}`}>{row.map((cell, cellIndex) => {
    const Tag = inHead || cell.header ? "th" : "td";
    const text = cleanTableCell(cell.text || "");
    const long = text.length > 80 || text.includes("\n");
    const style = {
      backgroundColor: safeTableColor(cell.background),
      color: safeTableColor(cell.color),
      textAlign: long ? "left" as const : cell.align,
      fontWeight: cell.bold ? 800 : undefined,
    };
    return <Tag
      className={long ? "is-long" : undefined}
      colSpan={Math.max(1, cell.colspan || 1)}
      rowSpan={Math.max(1, cell.rowspan || 1)}
      scope={Tag === "th" ? "col" : undefined}
      style={style}
      key={`${block.id}-${rowIndex}-${cellIndex}`}
    ><TableCellContent value={cell.text || ""}/></Tag>;
  })}</tr>;

  return <table className={`article-data-table is-source-faithful${block.compact ? " is-compact" : ""}`}>
    {headerCount > 0 && <thead>{block.cells.slice(0, headerCount).map((row, index) => renderRow(row, index, true))}</thead>}
    <tbody>{block.cells.slice(headerCount).map((row, index) => renderRow(row, index + headerCount, false))}</tbody>
  </table>;
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
        return <ArticleRichTextContent key={block.id} value={block.richText} fallback={block.text} className={block.lead ? "article-lead" : undefined}/>;
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
        return <div key={block.id} className={`article-note${block.compact ? " compact" : ""}`}><BlockIcon name={block.icon}/><div><strong>{block.title}</strong><ArticleRichTextContent value={block.richText} fallback={block.text}/></div></div>;
      case "warning":
        return <div key={block.id} className="article-warning"><strong>{block.title}</strong><ArticleRichTextContent value={block.richText} fallback={block.text}/></div>;
      case "cards":
        return <div key={block.id} className="key-grid">{block.items.map((item, index) => <div key={`${block.id}-${index}`}>{item.icon && <BlockIcon name={item.icon}/>}<strong>{item.title}</strong><p>{item.text}</p></div>)}</div>;
      case "audience-cards":
        return <div key={block.id} className="audience-grid">{block.items.filter((item) => visibleForAudience(item.scope, audience)).map((item, index) => <div className={item.scope} key={`${block.id}-${index}`}><span>{audienceLabel(item.scope)}</span><strong>{item.title}</strong><p>{item.text}</p></div>)}</div>;
      case "checklist":
        return <ol key={block.id} className="prepare-list">{block.items.filter((item) => visibleForAudience(item.scope, audience)).map((item, index) => <li className={item.scope} key={`${block.id}-${index}`}><span>{index + 1}</span><div><small>{audienceLabel(item.scope)}</small><strong>{item.title}</strong><p>{item.text}</p></div></li>)}</ol>;
      case "cta-cards":
        return <div key={block.id} className="article-link-grid">{block.items.filter((item) => visibleForAudience(item.scope, audience)).map((item, index) => <a className={`article-link-card ${item.scope}`} href={safeOutboundUrl(item.url)} target="_blank" rel="sponsored noopener noreferrer" key={`${block.id}-${index}`}><Gift size={24}/><div><small>{audienceLabel(item.scope)}</small><strong>{item.title}</strong><p>{item.text}</p><span>{item.action} <ArrowUpRight size={15}/></span></div></a>)}</div>;
      case "table":
        return <div key={block.id} className="article-data-table-wrap" tabIndex={0} aria-label="Таблица с данными"><EnhancedArticleTable block={block}/></div>;
      case "flow":
        return <div
          key={block.id}
          className="replica-flow"
          style={{
            "--flow-columns": block.items
              .map((_, index) => index < block.items.length - 1 ? "minmax(0,1fr) auto" : "minmax(0,1fr)")
              .join(" "),
          } as CSSProperties}
        >{block.items.flatMap((item, index) => [<div key={`${block.id}-item-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong>{item.subtitle && <small>{item.subtitle}</small>}</div>, ...(index < block.items.length - 1 ? [<ChevronRight key={`${block.id}-arrow-${index}`}/>] : [])])}</div>;
      case "image":
        return <figure key={block.id} className="article-wide-image"><img src={block.src} alt={block.alt}/>{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
      case "disclosure":
        return block.items.length >= 20
          ? <ReferenceArchive key={block.id} title={block.title} items={block.items}/>
          : <details key={block.id} className="article-disclosure"><summary>{block.title}<span>{block.items.length}</span></summary><div className="class-chip-grid">{block.items.map((item, index) => <span key={`${block.id}-${index}`}>{item}</span>)}</div></details>;
      case "opinion":
        return <figure key={block.id} className="oni-insight"><img src={block.image || "/oni-redplay.webp"} alt="Они – персонаж RedPlay"/><div><span>{block.label || "Мнение RedPlay"}</span><blockquote><ArticleRichTextContent value={block.richText} fallback={block.text}/></blockquote></div></figure>;
      case "video": {
        const youtubeId = block.source !== "file" ? youtubeVideoId(block.url) : null;
        if (youtubeId === "jiOzNaL7njw") return <ArticleVideoPlaylist key={block.id} title="Гномы после Iron Masters" text="Две официальные демонстрации помогают увидеть новый темп боя обоих переработанных гномьих классов." items={[
          { title: "Искатель Удачи", url: "https://www.youtube.com/watch?v=jiOzNaL7njw", text: "Кости, джекпот и снятие усилений" },
          { title: "Маэстро", url: "https://www.youtube.com/watch?v=PBzcJ_gaLbg", text: "Молот, усиления и Разрушенная броня" },
        ]}/>;
        if (youtubeId) return <figure key={block.id} className="article-video-player">
          <ArticleVideoEmbed videoId={youtubeId} title={block.title || "Видео RedPlay"} orientation={youtubeOrientation(block.url)}/>
          {(block.title || block.text || block.caption) && <figcaption>{block.title && <strong>{block.title}</strong>}{block.text && <ArticleRichTextContent value={block.richText} fallback={block.text}/>} {block.caption && <small>{block.caption}</small>}</figcaption>}
        </figure>;
        if (block.source === "file") return block.url ? <figure key={block.id} className="article-video-player">
          <ArticleVideoEmbed source="file" src={block.url} title={block.title || "Видео RedPlay"} poster={block.poster || undefined} orientation="auto"/>
          {(block.title || block.text || block.caption) && <figcaption>{block.title && <strong>{block.title}</strong>}{block.text && <ArticleRichTextContent value={block.richText} fallback={block.text}/>} {block.caption && <small>{block.caption}</small>}</figcaption>}
        </figure> : null;
        return block.url ? <a key={block.id} className="article-video-teaser" href={block.url} target="_blank" rel="noopener noreferrer"><span className="video-teaser-icon"><Play size={22} fill="currentColor"/></span><span><small>{block.label || "Видеоверсия"}</small><strong>{block.title}</strong><p>{block.text}</p></span><span className="video-teaser-action">{block.action || "Смотреть"} <ArrowUpRight size={15}/></span></a> : null;
      }
      case "video-playlist":
        return <ArticleVideoPlaylist key={block.id} title={block.title} text={block.text} items={block.items}/>;
      case "telegram":
        return <aside key={block.id} className="telegram-callout"><span className="telegram-callout-icon"><Send size={22}/></span><div><small>{block.label || "RedPlay в Telegram"}</small><strong>{block.title}</strong><ArticleRichTextContent value={block.richText} fallback={block.text}/></div><a href={block.url || "https://t.me/redplay2022"} target="_blank" rel="noopener noreferrer">{block.action || "Присоединиться"} <ArrowUpRight size={15}/></a></aside>;
    }
}

export function ArticleBlockRenderer({ blocks, audience = "all", insertDwarfSkillShowcase = false }: { blocks: ArticleBlock[]; audience?: ArticleAudience; insertDwarfSkillShowcase?: boolean }) {
  return blocks.filter((block) => audience === "all" || !block.scope || block.scope === "all" || block.scope === audience).map((block) => <Fragment key={block.id}>
    {insertDwarfSkillShowcase && block.type === "heading" && block.text.trim().toLowerCase() === "гномы: общее" && <ForgedDwarfSkillShowcase/>}
    {audience === "all" && block.scope && block.scope !== "all" && <span className={`article-scope-badge ${block.scope}`}>{block.scope === "essence" ? "ESSENCE" : "SPECIAL"}</span>}
    <RenderBlock block={block} audience={audience}/>
  </Fragment>);
}

