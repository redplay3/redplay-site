"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, FlaskConical, MapPinned, Swords } from "lucide-react";
import type { TestEdition, TestKind, TestRecord } from "@/lib/tests/types";
import styles from "@/app/lineage-2/tests/tests.module.css";

type Filter = "all" | TestKind;

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Все тесты" },
  { id: "class-comparison", label: "Выбор класса" },
  { id: "location-comparison", label: "Выбор локации" },
];

const editionLabels: Record<TestEdition, string> = {
  main: "MAIN",
  "essence-special": "ESSENCE · SPECIAL",
};

export function TestsCatalog({ tests }: { tests: TestRecord[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => tests.filter((test) => filter === "all" || test.kind === filter), [filter, tests]);

  return <>
    <div className={styles.filters} role="group" aria-label="Фильтр тестов">
      {filters.map((item) => <button key={item.id} type="button" className={filter === item.id ? styles.activeFilter : ""} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}
    </div>
    <div className={styles.catalogGrid}>
      {visible.map((test) => <Link className={styles.testCard} href={`/lineage-2/tests/${test.slug}`} key={test.id}>
        <div className={styles.cardTop}>
          <div className={styles.cardBadges}><span className={styles.testNumber}><FlaskConical size={15}/>{test.number}</span><span className={`${styles.editionBadge} ${test.edition === "main" ? styles.editionMain : styles.editionEssence}`}>{editionLabels[test.edition]}</span></div>
          <span className={styles.draftBadge}>Черновик</span>
        </div>
        <div className={styles.cardIcon}>{test.kind === "class-comparison" ? <Swords/> : <MapPinned/>}</div>
        <p className={styles.cardQuestion}>{test.question}</p>
        <h2>{test.shortTitle}</h2>
        <p className={styles.cardAnswer}>{test.answer}</p>
        <div className={styles.cardMeta}><span>{test.sampleLabel}</span><span>{test.kind === "class-comparison" ? "Класс vs класс" : "Локация vs локация"}</span></div>
        <div className={styles.cardDecision}><small>Помогает решить</small><strong>{test.decisions.map((item) => item.choice).join(" / ")}</strong></div>
        <span className={styles.openTest}>Открыть тест <ArrowRight size={16}/></span>
      </Link>)}
    </div>
  </>;
}
