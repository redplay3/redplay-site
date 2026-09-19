import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Database, FlaskConical, GitCompareArrows, ShieldCheck } from "lucide-react";
import { TestsCatalog } from "@/components/tests/tests-catalog";
import { redplayTests } from "@/lib/tests/data";
import styles from "./tests.module.css";

export const metadata: Metadata = {
  title: "RedPlay Tests — реальные замеры Lineage 2",
  description: "Сравнения классов и локаций на основе реальных игровых замеров RedPlay.",
  robots: { index: false, follow: false },
};

export default function TestsPage() {
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.brand}><span>R</span><strong>REDPLAY</strong></Link>
      <Link href="/" className={styles.back}><ArrowLeft size={16}/> На главную</Link>
      <span className={styles.previewPill}>Preview · не опубликовано</span>
    </div></header>

    <section className={styles.catalogHero}><div className={styles.catalogHeroInner}>
      <div className={styles.heroKicker}><FlaskConical size={17}/> REDPLAY TESTS</div>
      <h1>Не «кто сильнее», а <em>что выбрать под вашу цель</em></h1>
      <p>Реальные игровые замеры с методикой, ограничениями и ясным разделением: где данные игрока, а где редакционный вывод.</p>
      <div className={styles.principles}>
        <div><Database/><strong>Показываем условия</strong><span>Класс, локация, длительность и способ пересчёта.</span></div>
        <div><GitCompareArrows/><strong>Сравниваем решения</strong><span>Опыт и прибыль не смешиваются в один рейтинг.</span></div>
        <div><ShieldCheck/><strong>Не прячем ограничения</strong><span>Короткий тест — ориентир, а не обещание результата.</span></div>
      </div>
    </div></section>

    <section className={styles.catalogSection}><div className={styles.catalogWrap}>
      <div className={styles.catalogHeading}><div><span>Первые замеры</span><h2>Какой вопрос вы решаете?</h2></div><p>{redplayTests.length} исследования · оба в черновике</p></div>
      <TestsCatalog tests={redplayTests}/>
      <div className={styles.architectureNote}><strong>Почему это отдельный раздел</strong><p>Тест хранит связи с классами и локациями, условия замера и версии результатов. Один тест можно показать на странице Самурая, Диверсанта, ТОИ 9 или ТОИ 11 — без копирования содержания в четыре статьи.</p></div>
    </div></section>
  </main>;
}
