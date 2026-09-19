import type { TestRecord } from "./types";

export const redplayTests: TestRecord[] = [
  {
    id: "redplay-test-0001",
    number: "TEST #0001",
    slug: "samurai-vs-diversant-equal-boost",
    status: "draft",
    kind: "class-comparison",
    title: "Самурай vs Диверсант: фарм на равном бусте",
    shortTitle: "Самурай vs Диверсант",
    question: "Стоил ли реролл в Диверсанта того, если экипировка и уровень буста сопоставимы?",
    answer: "В этой серии Диверсант победил на всех трёх локациях, но преимущество менялось от +12,2% до +80,9% XP/ч.",
    summary: "Сравнение двух классов в одинаковой методике: три локации, короткие замеры и пересчёт темпа на час.",
    edition: "Lineage 2 Essence / Special Project",
    testedAt: null,
    patch: null,
    sampleLabel: "3 локации · по 6 минут на класс",
    contenders: [
      { id: "samurai", name: "Самурай", shortName: "Самурай", accent: "red" },
      { id: "diversant", name: "Диверсант", shortName: "Диверсант", accent: "cyan" },
    ],
    relations: [
      { id: "samurai", type: "class", name: "Самурай" },
      { id: "diversant", type: "class", name: "Диверсант" },
      { id: "captured-earth-fairies", type: "location", name: "Захваченные Феями земли" },
      { id: "land-of-shadows", type: "location", name: "Земля Теней" },
      { id: "elite-rakshasa-barracks", type: "location", name: "Казармы элитных ракшасов" },
    ],
    decisions: [
      { goal: "Выбираю класс для PvE", choice: "Диверсант", reason: "Он дал больше XP и адены во всех сохранённых сравнениях серии." },
      { goal: "Хочу понять размер преимущества", choice: "Смотри по локации", reason: "Разрыв не постоянный: на Земле Теней он заметно меньше, чем у Фей земли." },
    ],
    method: [
      "Сопоставимый буст и экипировка; классовые характеристики после реролла закономерно отличаются.",
      "Каждый класс тестировался по 6 минут на каждой из трёх локаций.",
      "Темп XP/ч и адены/ч получен пересчётом короткого замера ×10.",
      "Сравнивается конкретный персонаж RedPlay, а не теоретический максимум класса.",
    ],
    characterStats: [
      { label: "Физ. атака", values: { samurai: "56 230", diversant: "81 683" } },
      { label: "Урон в PvE", values: { samurai: "97%", diversant: "168%" } },
      { label: "Мощность физ. умений", values: { samurai: "234%", diversant: "277%" } },
      { label: "Шанс крит. атаки", values: { samurai: "137%", diversant: "196%" } },
      { label: "Сила крит. атаки", values: { samurai: "582%", diversant: "634%" } },
      { label: "Снижение отката", values: { samurai: "53,91%", diversant: "52%" } },
    ],
    scenarios: [
      {
        id: "captured-earth-fairies",
        name: "Захваченные Феями земли",
        durationMinutes: 6,
        values: {
          samurai: { xpPerHour: 316.74, adenaPerHour: 1.803 },
          diversant: { xpPerHour: 573, adenaPerHour: 2.745 },
        },
        xpDeltaPercent: 80.9,
        adenaDeltaPercent: 52.2,
        winnerXp: "diversant",
        winnerAdena: "diversant",
      },
      {
        id: "land-of-shadows",
        name: "Земля Теней",
        durationMinutes: 6,
        values: {
          samurai: { xpPerHour: 795.3, adenaPerHour: 2.368 },
          diversant: { xpPerHour: 892, adenaPerHour: 2.699 },
        },
        xpDeltaPercent: 12.2,
        adenaDeltaPercent: 14,
        winnerXp: "diversant",
        winnerAdena: "diversant",
      },
      {
        id: "elite-rakshasa-barracks",
        name: "Казармы элитных ракшасов",
        durationMinutes: 6,
        values: {
          samurai: { xpPerHour: 876, adenaPerHour: null },
          diversant: { xpPerHour: 1349, adenaPerHour: null },
        },
        xpDeltaPercent: 54,
        adenaDeltaPercent: 63.7,
        winnerXp: "diversant",
        winnerAdena: "diversant",
        adenaNote: "В исходной сводке сохранилась разница по адене (+63,7%), но не обе абсолютные величины. Они намеренно не восстановлены догадкой.",
      },
    ],
    measuredFacts: [
      "Диверсант показал больше XP/ч во всех трёх замерах.",
      "Минимальный разрыв по XP/ч зафиксирован на Земле Теней: +12,2%.",
      "Максимальный разрыв по XP/ч зафиксирован у Фей земли: +80,9%.",
      "Среднее преимущество по XP/ч в этой серии — около +41,5%.",
    ],
    interpretation: [
      "Локация влияет на разрыв между классами: одного среднего процента недостаточно для выбора.",
      "Для этого персонажа переход на Диверсанта дал практический прирост фарма, но не одинаковый на любом споте.",
    ],
    limitations: [
      "Шесть минут — короткое окно: случайный спавн, перемещения и единичные простои сильнее влияют на результат.",
      "Дата, сервер и версия патча в исходной сводке не зафиксированы — до публикации их нужно добавить.",
      "«Равный буст» означает сопоставимую экипировку, а не равные итоговые боевые характеристики.",
      "По Казармам не сохранены обе абсолютные величины адены/ч.",
    ],
    applicability: [
      "У вас сопоставимый уровень экипировки и похожий набор усилений.",
      "Вы фармите на одной из протестированных локаций или на споте с похожей плотностью целей.",
      "Вы сравниваете именно скорость PvE-охоты, а не PvP, стоимость реролла или удобство управления.",
    ],
    notProven: [
      "Что Диверсант всегда сильнее Самурая на любой локации.",
      "Что разница сохранится после другого патча или при другом бусте.",
      "Что реролл окупится по адене с учётом его стоимости.",
    ],
    video: { status: "awaiting-url", title: "Равный буст — фарм на 81% выше! Самурай VS Диверсант" },
    history: [
      { version: "v1", label: "Первичная серия замеров", state: "Текущий черновик" },
      { version: "v2", label: "Повтор после патча", state: "Можно добавить позже без перезаписи v1" },
    ],
  },
  {
    id: "redplay-test-0002",
    number: "TEST #0002",
    slug: "diversant-toi-9-vs-toi-11",
    status: "draft",
    kind: "location-comparison",
    title: "Диверсант: ТОИ 9 или ТОИ 11",
    shortTitle: "Диверсант · ТОИ 9 vs ТОИ 11",
    question: "Какую локацию выбрать Диверсанту: больше опыта или больше адены?",
    answer: "ТОИ 11 дал примерно +14% XP/ч, а ТОИ 9 — примерно +22% адены/ч.",
    summary: "Один класс, два этажа Башни Дерзости и два разных ответа — в зависимости от цели охоты.",
    edition: "Lineage 2 Essence / Special Project",
    testedAt: null,
    patch: null,
    sampleLabel: "2 локации · по 10 минут",
    contenders: [
      { id: "toi-9", name: "Башня Дерзости, 9 этаж", shortName: "ТОИ 9", accent: "red" },
      { id: "toi-11", name: "Башня Дерзости, 11 этаж", shortName: "ТОИ 11", accent: "cyan" },
    ],
    relations: [
      { id: "diversant", type: "class", name: "Диверсант" },
      { id: "toi-9", type: "location", name: "ТОИ 9" },
      { id: "toi-11", type: "location", name: "ТОИ 11" },
    ],
    decisions: [
      { goal: "Нужен максимальный опыт", choice: "ТОИ 11", reason: "1,975 млрд XP/ч против 1,733 млрд на ТОИ 9." },
      { goal: "Нужна максимальная адена", choice: "ТОИ 9", reason: "2,690 млн адены/ч против 2,209 млн на ТОИ 11." },
    ],
    method: [
      "Один и тот же персонаж класса Диверсант тестировался на двух этажах.",
      "На каждой локации сделан 10-минутный замер.",
      "Полученные значения нормализованы до темпа за час (×6).",
      "Сравниваются две цели охоты отдельно: опыт и валовая адена.",
    ],
    scenarios: [
      {
        id: "toi-comparison",
        name: "Один персонаж · две локации",
        durationMinutes: 10,
        values: {
          "toi-9": { xpPerHour: 1733, adenaPerHour: 2.69 },
          "toi-11": { xpPerHour: 1975, adenaPerHour: 2.209 },
        },
        xpDeltaPercent: 14,
        adenaDeltaPercent: 22,
        winnerXp: "toi-11",
        winnerAdena: "toi-9",
      },
    ],
    measuredFacts: [
      "ТОИ 11: 1,975 млрд XP/ч — на 242 млн больше, чем ТОИ 9.",
      "ТОИ 9: 2,690 млн адены/ч — на 481 тыс. больше, чем ТОИ 11.",
      "Разница составляет около +14% по опыту в пользу ТОИ 11 и +22% по адене в пользу ТОИ 9.",
    ],
    interpretation: [
      "Абсолютного победителя нет: выбор локации зависит от того, что игрок оптимизирует.",
      "ТОИ 11 рациональнее для ускорения прокачки, ТОИ 9 — для валовой прибыли в условиях этого замера.",
    ],
    limitations: [
      "Десятиминутный тест показывает темп, а не устойчивую часовую или суточную доходность.",
      "Валовая адена не учитывает расходники, простои, конкуренцию и случайные дропы.",
      "Дата, сервер, патч и полные характеристики персонажа нужно добавить до публикации.",
    ],
    applicability: [
      "Вы играете Диверсантом с сопоставимым темпом убийства.",
      "Вы выбираете между опытом и валовой аденой, а не оцениваете редкий дроп.",
      "На этажах нет существенно иной конкуренции или маршрута движения.",
    ],
    notProven: [
      "Что ТОИ 9 прибыльнее в чистой адене после расходников.",
      "Что час непрерывной охоты даст ровно шестикратный результат.",
      "Что вывод переносится на другой класс или заметно иной уровень буста.",
    ],
    video: { status: "awaiting-url", title: "Диверсант: ТОИ 9 vs ТОИ 11 — опыт против адены" },
    history: [
      { version: "v1", label: "Первичный 10-минутный тест", state: "Текущий черновик" },
      { version: "v2", label: "Контрольный часовой тест", state: "Рекомендуемый следующий замер" },
    ],
  },
];

export function getRedplayTest(slug: string) {
  return redplayTests.find((test) => test.slug === slug) || null;
}
