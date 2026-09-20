"use client";
/* eslint-disable @next/next/no-img-element -- skill icons are small database-driven sprites and should not use the image optimizer. */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { L2SkillRequirements, type RequirementItem, type SkillRequirement } from "./l2-skill-requirements";
import styles from "./l2-class-skill-catalog.module.css";

type Category = "all" | "attack" | "buff" | "unique" | "common";

type SkillRow = {
  skill_id: number;
  canonical_name_ru: string;
  type_label: string | null;
};

type ClassSkillRow = {
  skill_id: number;
  sort_order: number;
};

type LevelRow = {
  id: number;
  skill_id: number;
  skill_level: number;
  sub_level: number;
  name_ru: string;
  type_label: string | null;
  description_text: string;
  character_level: number | null;
  sp_cost: number | null;
  mp_cost: number | null;
  consumable: string | null;
  range_value: number | null;
  cast_time: string | null;
  cooldown: string | null;
  duration: string | null;
  target: string | null;
  area: string | null;
  required_items: string | null;
};

type ModificationRow = {
  id: number;
  skill_id: number;
  base_level: number | null;
  name: string;
  effect: string;
  cost: string;
};

type AliasRow = {
  id: number;
  skill_id: number;
  alias: string;
  alias_type: string;
  skill_level: number | null;
};

type IconUsage = {
  level?: number;
  skillId?: string;
  levelTitle?: string;
  skillTitle?: string;
};

type IconRow = {
  id: number;
  skill_id: number;
  source_url: string;
  file_name: string;
  storage_bucket: string | null;
  storage_path: string | null;
  usages: IconUsage[] | null;
  public_url?: string;
};

type SkillBundle = {
  skill: SkillRow;
  sortOrder: number;
  levels: LevelRow[];
  modifications: ModificationRow[];
  aliases: AliasRow[];
  icons: IconRow[];
  requirements: SkillRequirement[];
  category: Exclude<Category, "all">;
};

type RequirementQueryRow = {
  id: number;
  skill_level_id: number;
  quantity: number;
  sort_order: number;
  item: RequirementItem | RequirementItem[] | null;
};

const categories: Array<{ id: Category; label: string }> = [
  { id: "all", label: "Все" },
  { id: "attack", label: "Атакующие" },
  { id: "buff", label: "Усиления" },
  { id: "unique", label: "Уникальные пассивные" },
  { id: "common", label: "Общие умения" },
];

function classify(typeLabel: string | null): Exclude<Category, "all"> {
  const value = (typeLabel || "").toLowerCase();
  if (value.includes("физические умения")) return "attack";
  if (value.includes("умения положительных эффектов")) return "buff";
  if (value.includes("пассивные: уникальные умения")) return "unique";
  return "common";
}

function shortType(typeLabel: string | null) {
  if (!typeLabel) return "Навык";
  return typeLabel.replace(/^Активные:\s*/i, "").replace(/^Пассивные:\s*/i, "");
}

function cleanCost(value: string) {
  return value.replace(/\?\s*/g, "").replace(/\s+/g, " ").trim();
}

function cleanEffect(value: string) {
  return value
    .replace(/%%/g, "%")
    .replace(/\.([А-ЯЁ<])/g, ".\n$1")
    .replace(/>(?=[А-ЯЁ])/g, ">\n")
    .trim();
}

function preview(value: string) {
  const normalized = value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return normalized.length > 170 ? `${normalized.slice(0, 167)}…` : normalized;
}

function formatNumber(value: number | null) {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("ru-RU").format(value);
}

function iconForLevel(skill: SkillBundle, level: LevelRow) {
  const exact = skill.icons.find((icon) => (icon.usages || []).some((usage) => Number(usage.level) === level.skill_level));
  return exact || skill.icons[0];
}

function levelOptionLabel(level: LevelRow) {
  const skillLevel = `${level.skill_level}${level.sub_level ? `.${level.sub_level}` : ""}`;
  const characterLevel = level.character_level !== null ? ` · персонаж ${level.character_level}` : "";
  return `Ур. ${skillLevel} · ${level.name_ru}${characterLevel}`;
}

function SkillLevelPicker({ levels, value, onChange }: { levels: LevelRow[]; value: number; onChange: (index: number) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = levels[value] || levels[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const select = (index: number) => {
    onChange(index);
    setOpen(false);
  };

  return <div className={styles.levelPicker} ref={rootRef}>
    <span>Уровень навыка</span>
    <div className={styles.levelSelect}>
      <button
        type="button"
        className={styles.levelTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((shown) => !shown)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const direction = event.key === "ArrowDown" ? 1 : -1;
            select((value + direction + levels.length) % levels.length);
          }
        }}
      >
        <span>{levelOptionLabel(current)}</span>
        <ChevronDown size={18}/>
      </button>
      {open && <div className={styles.levelMenu} id={listId} role="listbox" aria-label="Выбор уровня навыка">
        {levels.map((item, index) => <button
          type="button"
          role="option"
          aria-selected={index === value}
          className={index === value ? styles.selectedLevel : undefined}
          onClick={() => select(index)}
          key={item.id}
        >
          <span>{levelOptionLabel(item)}</span>
          {index === value && <Check size={17}/>}
        </button>)}
      </div>}
    </div>
  </div>;
}

const effectMetricPatterns: Array<{ label: string; suffix: string; pattern: RegExp }> = [
  { label: "Количество атак", suffix: "", pattern: /атакует (?:цель|противников) (\d+) раза/i },
  { label: "Мощность", suffix: "", pattern: /Мощность\s+(\d+)/i },
  { label: "Количество целей", suffix: "", pattern: /не более\s+(\d+)\s+целей/i },
  { label: "Игнорирование защиты", suffix: "%", pattern: /Игнорирует\s+(\d+)%\s+защиты/i },
  { label: "Макс. HP", suffix: "%", pattern: /Макс\.\s*HP\s*\+(\d+)%/i },
  { label: "Физ. защита", suffix: "", pattern: /Физ\.\s*Защ\.?\s*\+(\d+)/i },
  { label: "Снижение физ. урона", suffix: "%", pattern: /Получаемый урон от физ\. умений\s*-(\d+)%/i },
  { label: "Мощность физ. умений", suffix: "%", pattern: /Мощность физ\. умений\s*\+(\d+)%/i },
];

function effectMetrics(value: string) {
  return effectMetricPatterns.flatMap(({ label, suffix, pattern }) => {
    const match = value.match(pattern);
    return match ? [{ label, suffix, value: Number(match[1]) }] : [];
  });
}

function modificationChangeText(value: string) {
  const [, changes = ""] = value.split(/<Эффект модификации>/i);
  return cleanEffect(changes);
}

function ModificationCard({ modification, baseDescription }: { modification: ModificationRow; baseDescription: string }) {
  const baseMetrics = new Map(effectMetrics(baseDescription).map((metric) => [metric.label, metric]));
  const changedMetrics = effectMetrics(modification.effect).filter((metric) => baseMetrics.get(metric.label)?.value !== metric.value);
  const changeText = modificationChangeText(modification.effect);

  return <div className={styles.mod}>
    <div className={styles.modTitle}>
      <strong>{modification.name}</strong>
      {modification.base_level !== null && <small>от ур. {modification.base_level}</small>}
    </div>
    {changedMetrics.length > 0 && <div className={styles.modMetrics}>
      {changedMetrics.map((metric) => {
        const base = baseMetrics.get(metric.label);
        const baseValue = base?.value ?? 0;
        const delta = metric.value - baseValue;
        return <div key={metric.label}>
          <span>{metric.label}</span>
          <strong>
            <del>{baseValue}{metric.suffix}</del><b aria-hidden="true">→</b>
            <ins>{metric.value}{metric.suffix}</ins>
          </strong>
          {delta !== 0 && <em>{delta > 0 ? "+" : ""}{delta}{metric.suffix}</em>}
        </div>;
      })}
    </div>}
    {changeText && <div className={styles.modChanges}><span>Что меняется</span><p>{changeText}</p></div>}
    {!changeText && modification.effect && <p className={styles.modEffect}>{cleanEffect(modification.effect)}</p>}
    {modification.cost && <div className={styles.modCost}><span>Стоимость и шанс</span><p>{cleanCost(modification.cost)}</p></div>}
  </div>;
}

function SkillEntry({ bundle }: { bundle: SkillBundle }) {
  const [open, setOpen] = useState(false);
  const [levelIndex, setLevelIndex] = useState(0);
  const level = bundle.levels[levelIndex] || bundle.levels[0];
  if (!level) return null;

  const icon = iconForLevel(bundle, level);
  const displayName = level.name_ru || bundle.skill.canonical_name_ru;
  const renamed = displayName !== bundle.skill.canonical_name_ru;
  const levelRequirements = bundle.requirements.filter((item) => item.skill_level_id === level.id);
  const params = [
    level.character_level !== null ? ["Уровень персонажа", String(level.character_level)] : null,
    level.sp_cost !== null ? ["SP", formatNumber(level.sp_cost)] : null,
    level.mp_cost !== null ? ["MP", formatNumber(level.mp_cost)] : null,
    level.range_value !== null ? ["Дальность", String(level.range_value)] : null,
    level.cast_time ? ["Применение", level.cast_time] : null,
    level.cooldown ? ["Перезарядка", level.cooldown] : null,
    level.duration ? ["Длительность", level.duration] : null,
    level.target ? ["Цель", level.target] : null,
    level.area ? ["Область", level.area] : null,
    level.consumable ? ["Расходник", level.consumable] : null,
  ].filter(Boolean) as string[][];

  return <article className={`${styles.skill} ${open ? styles.open : ""}`}>
    <button className={`${styles.skillHead} skill-catalog-entry`} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <span className={styles.iconWrap}>
        {icon?.public_url ? <img src={icon.public_url} alt="" loading="lazy"/> : <span className={styles.iconFallback}/>}
      </span>
      <span className={styles.identity}>
        <strong>{displayName}</strong>
        {renamed && <small>Базовый навык: {bundle.skill.canonical_name_ru}</small>}
        <em>{shortType(level.type_label || bundle.skill.type_label)}</em>
      </span>
      <span className={styles.desktopType}>{shortType(level.type_label || bundle.skill.type_label)}</span>
      <span className={styles.summary}>{preview(level.description_text)}</span>
      <span className={`${styles.headMeta} skill-toggle-meta`}>
        {level.consumable && <small>Руда Духов</small>}
        <ChevronDown size={18}/>
      </span>
    </button>

    {open && <div className={styles.details}>
      {bundle.levels.length > 1 && <SkillLevelPicker levels={bundle.levels} value={levelIndex} onChange={setLevelIndex}/>}

      <div className={styles.detailGrid}>
        <div className={styles.description}>
          <span>Описание</span>
          <p>{level.description_text}</p>
        </div>
        {params.length > 0 && <dl className={styles.stats}>
          {params.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>}
      </div>

      <L2SkillRequirements requirements={levelRequirements} legacyText={level.required_items}/>

      {bundle.modifications.length > 0 && <div className={styles.mods}>
        <div className={styles.modsHead}>
          <span>Модификации</span>
          <small>{bundle.modifications.length}</small>
        </div>
        <div className={styles.modGrid}>
          {bundle.modifications.map((modification) => <ModificationCard
            modification={modification}
            baseDescription={bundle.levels.find((item) => item.skill_level === modification.base_level)?.description_text || bundle.levels[0]?.description_text || ""}
            key={modification.id}
          />)}
        </div>
      </div>}

      {bundle.aliases.some((alias) => alias.alias_type !== "canonical") && <div className={styles.aliases}>
        <span>Другие названия</span>
        <p>{bundle.aliases.filter((alias) => alias.alias_type !== "canonical").map((alias) => alias.alias).join(" · ")}</p>
      </div>}
    </div>}
  </article>;
}

export function L2ClassSkillCatalog({ classSlug, title = "Навыки класса" }: { classSlug: string; title?: string }) {
  const [category, setCategory] = useState<Category>("all");
  const [skills, setSkills] = useState<SkillBundle[]>([]);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const supabase = createClient();
        const { data: classRow, error: classError } = await supabase
          .from("l2_classes")
          .select("id,name_ru")
          .eq("slug", classSlug)
          .maybeSingle();

        if (classError) throw classError;
        if (!classRow) throw new Error("Класс не найден в базе RedPlay.");

        const [classSkillsResult, levelsResult, modificationsResult, aliasesResult, iconsResult] = await Promise.all([
          supabase.from("l2_class_skills").select("skill_id,sort_order").eq("class_id", classRow.id).order("sort_order"),
          supabase.from("l2_skill_levels").select("id,skill_id,skill_level,sub_level,name_ru,type_label,description_text,character_level,sp_cost,mp_cost,consumable,range_value,cast_time,cooldown,duration,target,area,required_items").eq("class_id", classRow.id).order("skill_id").order("skill_level").order("sub_level"),
          supabase.from("l2_skill_modifications").select("id,skill_id,base_level,name,effect,cost").eq("class_id", classRow.id).order("skill_id").order("id"),
          supabase.from("l2_skill_aliases").select("id,skill_id,alias,alias_type,skill_level").eq("class_id", classRow.id).order("skill_id").order("id"),
          supabase.from("l2_skill_icons").select("id,skill_id,source_url,file_name,storage_bucket,storage_path,usages").eq("class_id", classRow.id).eq("storage_status", "uploaded").order("skill_id").order("id"),
        ]);

        const firstError = [classSkillsResult.error, levelsResult.error, modificationsResult.error, aliasesResult.error, iconsResult.error].find(Boolean);
        if (firstError) throw firstError;

        const classSkills = (classSkillsResult.data || []) as ClassSkillRow[];
        const ids = classSkills.map((item) => item.skill_id);
        const { data: skillRows, error: skillsError } = await supabase
          .from("l2_skills")
          .select("skill_id,canonical_name_ru,type_label")
          .in("skill_id", ids);
        if (skillsError) throw skillsError;

        const iconRows = ((iconsResult.data || []) as IconRow[]).map((icon) => ({
          ...icon,
          public_url: icon.storage_bucket && icon.storage_path
            ? supabase.storage.from(icon.storage_bucket).getPublicUrl(icon.storage_path).data.publicUrl
            : icon.source_url,
        }));

        const typedSkillRows = (skillRows || []) as SkillRow[];
        const skillMap = new Map<number, SkillRow>(typedSkillRows.map((item) => [item.skill_id, item]));
        const levels = (levelsResult.data || []) as LevelRow[];
        const modifications = (modificationsResult.data || []) as ModificationRow[];
        const aliases = (aliasesResult.data || []) as AliasRow[];
        const levelIds = levels.map((item) => item.id);
        let requirements: SkillRequirement[] = [];
        if (levelIds.length > 0) {
          const { data: requirementRows, error: requirementsError } = await supabase
            .from("l2_skill_level_requirements")
            .select("id,skill_level_id,quantity,sort_order,item:l2_requirement_items(id,name_ru,item_type,book_grade,icon_url)")
            .in("skill_level_id", levelIds)
            .order("sort_order");
          if (requirementsError) throw requirementsError;
          requirements = ((requirementRows || []) as RequirementQueryRow[]).flatMap((row) => {
            const item = Array.isArray(row.item) ? row.item[0] : row.item;
            return item ? [{
              id: row.id,
              skill_level_id: row.skill_level_id,
              quantity: row.quantity,
              sort_order: row.sort_order,
              item,
            }] : [];
          });
        }

        const bundles = classSkills
          .map((mapping) => {
            const skill = skillMap.get(mapping.skill_id);
            if (!skill) return null;
            const skillLevels = levels.filter((item) => item.skill_id === mapping.skill_id);
            return {
              skill,
              sortOrder: mapping.sort_order,
              levels: skillLevels,
              modifications: modifications.filter((item) => item.skill_id === mapping.skill_id),
              aliases: aliases.filter((item) => item.skill_id === mapping.skill_id),
              icons: iconRows.filter((item) => item.skill_id === mapping.skill_id),
              requirements: requirements.filter((requirement) => skillLevels.some((level) => level.id === requirement.skill_level_id)),
              category: classify(skill.type_label || skillLevels[0]?.type_label || null),
            } satisfies SkillBundle;
          })
          .filter(Boolean) as SkillBundle[];

        if (!cancelled) {
          setClassName(classRow.name_ru);
          setSkills(bundles);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Не удалось загрузить навыки.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [classSlug]);

  const counts = useMemo(() => ({
    all: skills.length,
    attack: skills.filter((item) => item.category === "attack").length,
    buff: skills.filter((item) => item.category === "buff").length,
    unique: skills.filter((item) => item.category === "unique").length,
    common: skills.filter((item) => item.category === "common").length,
  }), [skills]);

  const visibleSkills = useMemo(
    () => category === "all" ? skills : skills.filter((item) => item.category === category),
    [category, skills],
  );

  return <section className={styles.catalog} aria-labelledby="l2-skill-catalog-title">
    <header className={styles.heading}>
      <span>База знаний RedPlay</span>
      <h3 id="l2-skill-catalog-title">{title}{className ? ` · ${className}` : ""}</h3>
      <p>Выбери группу навыков. У каждого умения можно раскрыть уровни, требования, параметры и модификации. Если название или иконка меняются между уровнями, карточка показывает соответствующий вариант.</p>
    </header>

    <div className={styles.tabs} role="tablist" aria-label="Фильтр навыков">
      {categories.map((item) => <button
        type="button"
        role="tab"
        aria-selected={category === item.id}
        className={category === item.id ? styles.activeTab : undefined}
        onClick={() => setCategory(item.id)}
        key={item.id}
      ><span>{item.label}</span><small>{counts[item.id]}</small></button>)}
    </div>

    {loading && <div className={styles.state}><LoaderCircle className={styles.spinner} size={22}/> Загружаю справочник навыков…</div>}
    {!loading && error && <div className={styles.stateError}>{error}</div>}

    {!loading && !error && <div className={styles.list}>
      <div className={styles.desktopHeader} aria-hidden="true">
        <span/>
        <span>Навык</span>
        <span>Тип</span>
        <span>Кратко</span>
        <span/>
      </div>
      {visibleSkills.map((bundle) => <SkillEntry bundle={bundle} key={bundle.skill.skill_id}/>)}
    </div>}
  </section>;
}
