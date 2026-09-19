import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Clock3, Database, Film, FlaskConical, History, Link2, Scale, ShieldCheck, Target, X } from "lucide-react";
import type { EvidenceKind, TestEdition, TestRecord } from "@/lib/tests/types";
import styles from "@/app/lineage-2/tests/tests.module.css";

function EvidenceBadge({ kind }: { kind: EvidenceKind }) {
  const labels: Record<EvidenceKind, string> = {
    measurement: "Измерение пользователя",
    calculation: "Расчёт из замера",
    interpretation: "Вывод редакции",
  };
  return <span className={`${styles.evidenceBadge} ${styles[kind]}`}>{labels[kind]}</span>;
}

const editionLabels: Record<TestEdition, string> = {
  main: "MAIN",
  "essence-special": "ESSENCE · SPECIAL",
};

function formatValue(value: number | null, metric: "xp" | "adena") {
  if (value === null) return "Нет исходных данных";
  if (metric === "xp" && value >= 1000) return `${(value / 1000).toLocaleString("ru-RU", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} млрд`;
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 3 })} млн`;
}

function ResultBars({ test, metric }: { test: TestRecord; metric: "xp" | "adena" }) {
  const values = test.scenarios.flatMap((scenario) => test.contenders.filter((contender) => !scenario.contenderIds || scenario.contenderIds.includes(contender.id)).map((contender) => scenario.values[contender.id]?.[metric === "xp" ? "xpPerHour" : "adenaPerHour"] || 0));
  const max = Math.max(...values, 1);
  return <div className={styles.resultScenarios}>
    {test.scenarios.map((scenario) => <section className={styles.scenarioCard} key={`${scenario.id}-${metric}`}>
      <div className={styles.scenarioHead}><div><span>{scenario.durationMinutes} минут · пересчёт на час</span><h3>{scenario.name}</h3></div><strong>+{metric === "xp" ? scenario.xpDeltaPercent : scenario.adenaDeltaPercent ?? "—"}%</strong></div>
      <div className={styles.bars}>
        {test.contenders.filter((contender) => !scenario.contenderIds || scenario.contenderIds.includes(contender.id)).map((contender) => {
          const value = scenario.values[contender.id]?.[metric === "xp" ? "xpPerHour" : "adenaPerHour"] ?? null;
          return <div className={styles.barRow} key={contender.id}>
            <div className={styles.barLabel}><strong>{contender.shortName}</strong><span>{value === null ? scenario.unavailableReason?.[contender.id] || formatValue(value, metric) : `${formatValue(value, metric)} / ч`}</span></div>
            <div className={styles.barTrack}><i className={contender.accent === "cyan" ? styles.cyanBar : styles.redBar} style={{ width: value === null ? "0%" : `${Math.max(4, value / max * 100)}%` }}/></div>
          </div>;
        })}
      </div>
      {(metric === "xp" ? scenario.xpNote : scenario.adenaNote) && <p className={styles.dataGap}><AlertTriangle size={16}/>{metric === "xp" ? scenario.xpNote : scenario.adenaNote}</p>}
    </section>)}
  </div>;
}

export function TestDetail({ test }: { test: TestRecord }) {
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.brand}><span>R</span><strong>REDPLAY</strong></Link>
      <Link href="/lineage-2/tests" className={styles.back}><ArrowLeft size={16}/> Все тесты</Link>
      <span className={styles.previewPill}>Preview · не опубликовано</span>
    </div></header>

    <section className={styles.detailHero}><div className={styles.detailHeroInner}>
      <div className={styles.breadcrumb}><Link href="/">Главная</Link><ChevronRight size={13}/><Link href="/lineage-2/tests">RedPlay Tests</Link><ChevronRight size={13}/><span>{test.number}</span></div>
      <div className={styles.heroMeta}><span><FlaskConical size={15}/>{test.number}</span><span className={`${styles.editionBadge} ${test.edition === "main" ? styles.editionMain : styles.editionEssence}`}>{editionLabels[test.edition]}</span><span><Clock3 size={15}/>{test.sampleLabel}</span></div>
      <h1>{test.title}</h1>
      <p>{test.question}</p>
      <div className={styles.heroAnswer}><small>Короткий ответ</small><strong>{test.answer}</strong></div>
    </div></section>

    <div className={styles.detailLayout}>
      <aside className={styles.toc} aria-label="Содержание теста">
        <strong>В этом тесте</strong>
        <a href="#decision">Решение</a><a href="#method">Методика</a><a href="#results">Результаты</a><a href="#meaning">Что это значит</a><a href="#fit">Применимость</a><a href="#limits">Ограничения</a><a href="#history">История</a>
      </aside>

      <article className={styles.detailBody}>
        <section id="decision" className={styles.decisionPanel}>
          <div className={styles.sectionIntro}><span>01 · Решение игрока</span><h2>Выбор зависит от цели</h2><p>Цифра полезна только тогда, когда понятно, какое действие из неё следует.</p></div>
          <div className={styles.decisionGrid}>{test.decisions.map((decision) => <div key={decision.goal}><small>{decision.goal}</small><strong>{decision.choice}</strong><p>{decision.reason}</p></div>)}</div>
        </section>

        <section id="method" className={styles.contentSection}>
          <div className={styles.sectionIntro}><span>02 · Методика</span><h2>Что именно сравнивали</h2><p>Здесь отделены условия эксперимента от красивых, но бесполезных процентов.</p></div>
          <div className={styles.evidenceLegend}><EvidenceBadge kind="measurement"/><EvidenceBadge kind="calculation"/><EvidenceBadge kind="interpretation"/></div>
          <div className={styles.methodGrid}>{test.method.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></div>)}</div>
          <div className={styles.entityLinks}><Link2 size={17}/><div>{test.relations.map((ref) => <span key={`${ref.type}-${ref.id}`}><small>{ref.type === "class" ? "Класс" : "Локация"}</small>{ref.name}</span>)}</div></div>
          {test.characterStats && <div className={styles.statsTableWrap}><div className={styles.tableTitle}><div><strong>Характеристики перед сравнением</strong><p>Сопоставимый буст не сделал боевые показатели одинаковыми — это часть результата реролла.</p></div><EvidenceBadge kind="measurement"/></div><table className={styles.statsTable}><thead><tr><th>Параметр</th>{test.contenders.map((item) => <th key={item.id}>{item.shortName}</th>)}</tr></thead><tbody>{test.characterStats.map((row) => <tr key={row.label}><td>{row.label}</td>{test.contenders.map((item) => <td key={item.id}>{row.values[item.id]}</td>)}</tr>)}</tbody></table></div>}
          {!!test.evidenceImages?.length && <div className={styles.evidenceImages}>{test.evidenceImages.map((item) => <figure key={item.src}><Image src={item.src} alt={item.alt} width={item.width || 1920} height={item.height || 1080} sizes="(max-width: 900px) 100vw, 850px"/><figcaption><EvidenceBadge kind="measurement"/><span>{item.caption}</span></figcaption></figure>)}</div>}
        </section>

        <section id="results" className={styles.contentSection}>
          <div className={styles.sectionIntro}><span>03 · Результаты</span><h2>Опыт и адена отвечают на разные вопросы</h2><p>Все значения «в час» — нормализация короткого замера, а не запись полного часа охоты.</p></div>
          <div className={styles.metricBlock}><div className={styles.metricHead}><div><Target size={20}/><span><small>Темп прокачки</small><strong>Опыт / час</strong></span></div><EvidenceBadge kind="calculation"/></div><ResultBars test={test} metric="xp"/></div>
          <div className={styles.metricBlock}><div className={styles.metricHead}><div><Database size={20}/><span><small>Валовая экономика</small><strong>Адена / час</strong></span></div><EvidenceBadge kind="calculation"/></div><ResultBars test={test} metric="adena"/></div>
        </section>

        <section id="meaning" className={styles.contentSection}>
          <div className={styles.sectionIntro}><span>04 · Значение</span><h2>Факт отдельно, вывод отдельно</h2></div>
          <div className={styles.meaningGrid}><div className={styles.factPanel}><div><ShieldCheck size={20}/><EvidenceBadge kind="measurement"/></div><h3>Что показали числа</h3><ul>{test.measuredFacts.map((item) => <li key={item}><Check size={16}/>{item}</li>)}</ul></div><div className={styles.interpretationPanel}><div><Scale size={20}/><EvidenceBadge kind="interpretation"/></div><h3>Как RedPlay это читает</h3><ul>{test.interpretation.map((item) => <li key={item}><ChevronRight size={16}/>{item}</li>)}</ul></div></div>
        </section>

        <section id="fit" className={styles.contentSection}>
          <div className={styles.sectionIntro}><span>05 · Применимость</span><h2>Насколько это похоже на ваш случай</h2><p>Чем больше совпадений, тем полезнее тест как ориентир. Это не калькулятор гарантированного результата.</p></div>
          <div className={styles.fitList}>{test.applicability.map((item) => <div key={item}><Check size={17}/><span>{item}</span></div>)}</div>
        </section>

        <section id="limits" className={styles.contentSection}>
          <div className={styles.sectionIntro}><span>06 · Границы вывода</span><h2>Чего этот тест не доказывает</h2></div>
          <div className={styles.limitGrid}><div className={styles.warningPanel}><h3><AlertTriangle size={19}/> Ограничения данных</h3><ul>{test.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div><div className={styles.noProofPanel}><h3><X size={19}/> Нельзя утверждать</h3><ul>{test.notProven.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
        </section>

        <section className={styles.videoPanel}><div className={styles.videoIcon}><Film size={28}/></div><div><span>Видео теста</span><h2>{test.video.title}</h2>{test.video.status === "linked" && test.video.url ? <a href={test.video.url} target="_blank" rel="noreferrer">Смотреть видео на YouTube</a> : <p>URL ролика не был сохранён в исходной сводке. Блок готов и будет подключён без изменения страницы, когда ссылка будет подтверждена.</p>}</div><span className={styles.videoStatus}>{test.video.status === "linked" ? "Видео подключено" : "Ожидает ссылку"}</span></section>

        <section id="history" className={styles.contentSection}>
          <div className={styles.sectionIntro}><span>07 · История замеров</span><h2>Новый патч не переписывает старый результат</h2><p>Каждый повтор сохраняется отдельной версией. Так можно увидеть изменение класса или локации во времени.</p></div>
          <div className={styles.historyList}>{test.history.map((item, index) => <div key={item.version}><span><History size={17}/>{item.version}</span><strong>{item.label}</strong><small>{item.state}</small>{index < test.history.length - 1 && <i/>}</div>)}</div>
        </section>
      </article>
    </div>
  </main>;
}
