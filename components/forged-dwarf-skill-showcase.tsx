"use client";

import { useMemo, useState } from "react";
import styles from "./forged-dwarf-skill-showcase.module.css";

type DwarfClassId = "fortune-seeker" | "maestro";

type SkillVideo = {
  id: string;
  title: string;
  originalTitle?: string;
  video: string;
  summary: string;
  details?: string[];
};

type DwarfClass = {
  id: DwarfClassId;
  title: string;
  role: string;
  skills: SkillVideo[];
};

const VIDEO_BASE = "https://vpsocmwsvwyavrmduzth.supabase.co/storage/v1/object/public/article-media/2026/video/forged-in-battle-dwarf-skills";

const dwarfClasses: DwarfClass[] = [
  {
    id: "fortune-seeker",
    title: "Искатель Удачи",
    role: "Урон, контроль и дополнительные материалы",
    skills: [
      {
        id: "rolling-dice-master",
        title: "Катящиеся кости: Мастер",
        originalTitle: "Rolling Dice: Master",
        video: `${VIDEO_BASE}/f01.mp4`,
        summary: "Значительно усиливает боевые способности и с определённым шансом активирует один из двух особых эффектов.",
        details: [
          "Джекпот повышает бонус урона физических PvE-умений и активирует дополнительные удары.",
          "Убийца баффов увеличивает оружие персонажа и снимает четыре усиления с противников, чей уровень HP опустился ниже заданной отметки.",
        ],
      },
      {
        id: "fortune-spin-rain-force",
        title: "Вращение удачи: Ливень силы",
        originalTitle: "Fortune Spin: Rain Force",
        video: `${VIDEO_BASE}/f02.mp4`,
        summary: "Наносит урон по области вокруг выбранной цели и одновременно ослабляет попавших под удар противников.",
        details: ["Дебафф снижает сопротивление мечам, палицам, парным и древним мечам."],
      },
      {
        id: "spoil-destroyer",
        title: "Уничтожитель добычи",
        originalTitle: "Spoil Destroyer",
        video: `${VIDEO_BASE}/f03.mp4`,
        summary: "Проводит две мощные атаки по области и с определённым шансом приносит дополнительные материалы для ремесла гномов.",
      },
      {
        id: "fortune-wave",
        title: "Волна удачи",
        originalTitle: "Fortune Wave",
        video: `${VIDEO_BASE}/f04.mp4`,
        summary: "Поражает противников по области и накладывает на них Слабость удачи.",
        details: ["Слабость удачи уменьшает одно из сопротивлений цели: параличу, запечатыванию, шоку или удержанию."],
      },
      {
        id: "fortune-hit-dream",
        title: "Удар удачи: Мечта",
        originalTitle: "Fortune Hit: Dream",
        video: `${VIDEO_BASE}/f05.mp4`,
        summary: "Наносит выбранной цели два последовательных удара чрезвычайно высокой мощности.",
      },
      {
        id: "random-weapon-performance",
        title: "Случайное проявление оружия",
        originalTitle: "Random Weapon Performance",
        video: `${VIDEO_BASE}/f06.mp4`,
        summary: "Проводит две мощные атаки по области и накладывает на противников случайный эффект контроля.",
        details: ["Возможные эффекты: оглушение, сбивание с ног или страх."],
      },
      {
        id: "fortune-dance",
        title: "Танец удачи",
        originalTitle: "Fortune Dance",
        video: `${VIDEO_BASE}/f07.mp4`,
        summary: "Заставляет врагов вокруг цели танцевать, а после завершения эффекта наносит урон по области и замедляет их.",
        details: [
          "Во время танца нельзя передвигаться, атаковать, возвращаться, применять умения и восстанавливать HP, MP или CP.",
          "Замедление снижает физическую и магическую защиту, а также скорость передвижения.",
        ],
      },
    ],
  },
  {
    id: "maestro",
    title: "Маэстро",
    role: "Молоты, Разрушенная броня и поддержка группы",
    skills: [
      {
        id: "prime-maestro-master",
        title: "Прайм Маэстро: Мастер",
        originalTitle: "Prime Maestro: Master",
        video: `${VIDEO_BASE}/m01.mp4`,
        summary: "Усиливает самого Маэстро и накладывает Разрушенную броню Ур. 3 на окружающих противников.",
        details: [
          "Персонаж получает больше максимального HP, физической атаки, урона, шанса и силы критических атак физическими умениями, шанса шока, сопротивления дебаффам и скорости передвижения.",
          "Разрушенная броня Ур. 3 снижает базовую защиту доспехов и вероятность срабатывания их особых эффектов.",
        ],
      },
      {
        id: "mafr-hammer",
        title: "Молот Мафр",
        video: `${VIDEO_BASE}/m02.mp4`,
        summary: "Серия ударов молотом по окружающим противникам. Умение доступно в состоянии «Прайм Маэстро: Мастер».",
        details: [
          "В PvP выполняет две атаки по области; против цели с Разрушенной бронёй добавляет ещё один удар и обездвиживание.",
          "В PvE выполняет три атаки по области.",
        ],
      },
      {
        id: "flying-hammer",
        title: "Летающий молот",
        video: `${VIDEO_BASE}/m03.mp4`,
        summary: "Вращающиеся вокруг Маэстро молоты дважды поражают врагов по области, оглушают их и накладывают шок.",
        details: ["В PvP дополнительно накладывает Разрушенную броню и снижает защиту доспехов."],
      },
      {
        id: "broken-match",
        title: "Брокен Матч",
        originalTitle: "Broken Match",
        video: `${VIDEO_BASE}/m04.mp4`,
        summary: "Наносит мощный удар по области и повышенный урон защитным барьерам.",
        details: ["Заточка добавляет ещё один удар, увеличивает мощность и сокращает время перезарядки умения."],
      },
      {
        id: "iron-hammer-shot",
        title: "Выстрел железного молота",
        video: `${VIDEO_BASE}/m05.mp4`,
        summary: "Бросает молот в противников, наносит урон по области и ослабляет их защиту.",
        details: ["Дебафф снижает сопротивление шоку, мечам, палицам, копьям, парным и древним мечам."],
      },
      {
        id: "heavy-strike",
        title: "Тяжёлый удар",
        video: `${VIDEO_BASE}/m06.mp4`,
        summary: "Наносит два мощных удара и с определённым шансом активирует дополнительную атаку.",
      },
      {
        id: "blacksmith",
        title: "Чёрный кузнец",
        video: `${VIDEO_BASE}/m07.mp4`,
        summary: "Восстанавливает CP союзников и защищает их оружие от вражеских воздействий.",
        details: ["Мгновенно восстанавливает 5000 CP и повышает сопротивление снятию и повреждению оружия."],
      },
    ],
  },
];

export function ForgedDwarfSkillShowcase() {
  const [activeClassId, setActiveClassId] = useState<DwarfClassId>("fortune-seeker");
  const [selectedSkills, setSelectedSkills] = useState<Record<DwarfClassId, number>>({ "fortune-seeker": 0, maestro: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);
  const activeClass = useMemo(() => dwarfClasses.find((item) => item.id === activeClassId) || dwarfClasses[0], [activeClassId]);
  const activeSkillIndex = selectedSkills[activeClassId];
  const activeSkill = activeClass.skills[activeSkillIndex] || activeClass.skills[0];

  const selectClass = (classId: DwarfClassId) => {
    setActiveClassId(classId);
    setHasInteracted(true);
  };

  const selectSkill = (index: number) => {
    setSelectedSkills((current) => ({ ...current, [activeClassId]: index }));
    setHasInteracted(true);
  };

  return <section className={styles.showcase} aria-labelledby="dwarf-skill-videos-title">
    <header className={styles.heading}>
      <span>14 демонстраций умений</span>
      <h3 id="dwarf-skill-videos-title">Гномы в бою: выбери класс и умение</h3>
      <p>Короткие игровые фрагменты показывают механику новых умений без отрыва от их описания.</p>
    </header>

    <div className={styles.layout}>
      <aside className={styles.controls}>
        <div className={styles.classTabs} role="tablist" aria-label="Выбор класса гномов">
          {dwarfClasses.map((dwarfClass) => <button type="button" role="tab" aria-selected={dwarfClass.id === activeClassId} className={dwarfClass.id === activeClassId ? styles.activeClass : undefined} onClick={() => selectClass(dwarfClass.id)} key={dwarfClass.id}>{dwarfClass.title}</button>)}
        </div>

        <p className={styles.classRole}>{activeClass.role}</p>
        <div className={styles.skillTabs} role="tablist" aria-label={`Умения класса ${activeClass.title}`}>
          {activeClass.skills.map((skill, index) => <button type="button" role="tab" aria-selected={index === activeSkillIndex} className={index === activeSkillIndex ? styles.activeSkill : undefined} onClick={() => selectSkill(index)} key={skill.id}>
            <span>{String(index + 1).padStart(2, "0")}</span><strong>{skill.title}</strong>
          </button>)}
        </div>

        <div className={styles.description} aria-live="polite">
          <span>Как работает</span><strong>{activeSkill.title}</strong>
          {activeSkill.originalTitle && <small>{activeSkill.originalTitle}</small>}
          <p>{activeSkill.summary}</p>
          {activeSkill.details?.map((detail) => <p key={detail}>{detail}</p>)}
        </div>
      </aside>

      <div className={styles.player}>
        <video key={activeSkill.video} controls playsInline preload="metadata" autoPlay={hasInteracted} loop>
          <source src={activeSkill.video} type="video/mp4"/><a href={activeSkill.video}>Открыть видео умения</a>
        </video>
        <div className={styles.playerCaption}>
          <span>{activeClass.title}</span><strong>{activeSkill.title}</strong><small>{String(activeSkillIndex + 1).padStart(2, "0")} / {String(activeClass.skills.length).padStart(2, "0")}</small>
        </div>
      </div>
    </div>
  </section>;
}
