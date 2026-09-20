import { BookOpen, Package } from "lucide-react";
import styles from "./l2-skill-requirements.module.css";

export type BookGrade = "improved" | "exceptional" | "rare" | "heroic" | "legendary";

export type RequirementItem = {
  id: number;
  name_ru: string;
  item_type: "book" | "item" | "currency";
  book_grade: BookGrade | null;
  icon_url: string | null;
};

export type SkillRequirement = {
  id: number;
  skill_level_id: number;
  quantity: number;
  sort_order: number;
  item: RequirementItem;
};

const gradeLabels: Record<BookGrade, string> = {
  improved: "Улучшенная",
  exceptional: "Исключительная",
  rare: "Редкая",
  heroic: "Героическая",
  legendary: "Легендарная",
};

const legacyBookGradePatterns: Array<[BookGrade, RegExp]> = [
  ["improved", /(?:^|купон на\s+)улучшенн\S*\s+книг/i],
  ["exceptional", /(?:^|купон на\s+)исключительн\S*\s+книг/i],
  ["rare", /(?:^|купон на\s+)редк\S*\s+книг/i],
  ["heroic", /(?:^|купон на\s+)героическ\S*\s+(?:книг|пророчеств)/i],
  ["legendary", /(?:^|купон на\s+)легендарн\S*\s+(?:книг|пророчеств)/i],
];

function cleanLegacyRequirement(value: string) {
  return value
    .replace(/^Приоритетное использование временных и запечатанных предметов\s*/i, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+\|\s+/g, " · ")
    .trim();
}

function inferBookGrade(value: string): BookGrade | null {
  return legacyBookGradePatterns.find(([, pattern]) => pattern.test(value))?.[0] || null;
}

function legacyRequirement(value: string): SkillRequirement | null {
  const name = cleanLegacyRequirement(value);
  if (!name) return null;
  const bookGrade = inferBookGrade(name);
  const isBook = /книг|пророчеств/i.test(name);
  return {
    id: -1,
    skill_level_id: -1,
    quantity: 1,
    sort_order: 0,
    item: {
      id: -1,
      name_ru: name,
      item_type: isBook ? "book" : /^\d[\d\s]*$/.test(name) ? "currency" : "item",
      book_grade: isBook ? bookGrade : null,
      icon_url: null,
    },
  };
}

export function L2SkillRequirements({
  requirements,
  legacyText,
}: {
  requirements: SkillRequirement[];
  legacyText: string | null;
}) {
  const legacy = legacyText ? legacyRequirement(legacyText) : null;
  const rows = requirements.length > 0 ? requirements : legacy ? [legacy] : [];
  if (rows.length === 0) return null;

  return <section className={styles.requirement} aria-label="Требования изучения навыка">
    <span className={styles.heading}>Требование изучения</span>
    <div className={styles.list}>
      {rows.map((requirement) => {
        const { item } = requirement;
        const grade = item.book_grade;
        const isBook = item.item_type === "book";
        return <div
          className={styles.item}
          data-grade={grade || undefined}
          key={`${requirement.id}-${item.id}`}
        >
          <span className={styles.icon} aria-hidden="true">
            {item.icon_url
              ? <img src={item.icon_url} alt="" loading="lazy"/>
              : isBook ? <BookOpen size={19}/> : <Package size={19}/>}
          </span>
          <span className={styles.copy}>
            {grade && <small>{gradeLabels[grade]} книга</small>}
            <strong>{item.name_ru}</strong>
          </span>
          {requirement.quantity > 1 && <span className={styles.quantity}>×{requirement.quantity}</span>}
        </div>;
      })}
    </div>
  </section>;
}
