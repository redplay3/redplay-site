export const editions = ["Essence", "Special Project", "Main"] as const;
export type Edition = (typeof editions)[number];

export const knowledgeSections = [
  { title: "Классы", description: "Архетипы, пути развития и роль в PvE и PvP.", icon: "classes", href: "#knowledge" },
  { title: "Умения", description: "Эффекты, уровни изучения, стоимость и изменения по патчам.", icon: "skills", href: "#knowledge" },
  { title: "Зоны охоты", description: "Уровни, монстры, награды и требования к персонажу.", icon: "zones", href: "#knowledge" },
  { title: "Предметы", description: "Экипировка, ресурсы, способы получения и улучшения.", icon: "items", href: "#knowledge" },
  { title: "Гайды", description: "Проверенные сборки, маршруты развития и механики.", icon: "guides", href: "#knowledge" },
  { title: "Калькуляторы", description: "Заточка, фарм, прокачка и сравнение характеристик.", icon: "calculators", href: "#tools" },
] as const;

export const featuredUpdate = { category: "Крупное обновление", date: "12 сентября 2026", readTime: "18 мин", title: "Replica для Lineage 2 Main: межсерверные вторжения, Гора Богов и 13 новых агатионов", summary: "Разбираем главное обновление осени: как работает Реплика, что изменится в Свержении, какие зоны откроются на 131–132 уровнях и к чему готовиться заранее.", tags: ["Main", "Replica", "Гора Богов", "Новые зоны"] };

export const latestPosts = [
  { edition: "Main", category: "Обновление", date: "12.09.2026", title: "Replica: главное для новичков и вернувшихся игроков", summary: "Межсерверная Реплика, новые зоны, Каратель Тира, агатионы и изменения фарма – без сотен строк патчноута." },
  { edition: "Main", category: "Патчноут", date: "11.09.2026", title: "Изменения классов в Forged in Battle", summary: "Какие умения переработаны и как это влияет на текущую мету." },
  { edition: "Special Project", category: "База знаний", date: "09.09.2026", title: "Диверсант: навыки и приоритет изучения", summary: "Структурированный список редких, исключительных и улучшенных умений." },
  { edition: "Special Project", category: "Сравнение", date: "07.09.2026", title: "Самурай против Диверсанта: фарм", summary: "Сопоставление опыта и адены на серверных и межсерверных локациях." },
  { edition: "Main", category: "Гайд", date: "04.09.2026", title: "Как читать корейские патчноуты", summary: "Термины, расхождения локализаций и проверка игровых значений." },
];
