"use client";

import {
  Activity, ArrowRight, ArrowUpRight, Bell, BookOpen, Box, Calculator, ChevronLeft, ChevronRight,
  Clock3, Crosshair, Database, Flame, Gift, Map, Menu, Newspaper, Play, Search,
  Send, Shield, Sparkles, Swords, Video as Youtube, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { editions, knowledgeSections, type Edition } from "@/lib/content";
import { articleCategories } from "@/lib/articles/catalog";
import { readEditionPreference, saveEditionPreference, type EditionPreference } from "@/lib/edition-preference";
import { createClient } from "@/lib/supabase/client";

type Video = { id: string; title: string; url: string; thumbnail: string; published: string };
type OnlineServer = { name: string; online: number };
type OnlineEdition = "Main" | "Special Project" | "Essence";
type BonusGroup = "Main" | "Essence / Special Project";
type OnlineGroups = Record<OnlineEdition, OnlineServer[]>;
type PublishedArticle = { id: string; title: string; description: string; label: string; cover: { src?: string; alt?: string } | null; edition: "main" | "essence" | "special-project"; category: string; slug: string; tags: string[] | null; published_at: string | null; updated_at: string };
const editionLabels: Record<EditionPreference, Edition> = {
  all: "Все версии",
  main: "Main",
  essence: "Essence / Special Project",
};
const editionValues: Record<Edition, EditionPreference> = {
  "Все версии": "all",
  Main: "main",
  "Essence / Special Project": "essence",
};
const subscribeToEditionPreference = () => () => undefined;
const fallbackHero = {
  title: "Forged in Battle в Lineage 2: все классы, умения и точные изменения",
  description: "Полный разбор большого обновления: классы, новые зоны, предметы, крафт и различия Essence и Special Project.",
  label: "Большое обновление",
  cover: "https://vpsocmwsvwyavrmduzth.supabase.co/storage/v1/object/public/article-media/2026/3764614b-53ac-42eb-aacb-5a43c563c0ea-forged-in-battle-cover.png",
  href: "/lineage-2/essence/updates/forged-in-battle-vse-klassy-i-umeniya",
  publishedAt: "2026-09-13T00:00:00.000Z",
};
const replicaArticle: PublishedArticle = {
  id: "replica-static",
  title: "Replica для Lineage 2 Main: межсерверные вторжения, Гора Богов и 13 новых агатионов",
  description: "Разбираем главное обновление осени: как работает Реплика, что изменится в Свержении, какие зоны откроются на 120–132 уровнях и к чему готовиться заранее.",
  label: "Перевод из Кореи",
  cover: { src: "/replica-hero.webp", alt: "Обновление Replica для Lineage 2 Main" },
  edition: "main",
  category: "updates",
  slug: "replica",
  tags: ["Main", "Replica", "Гора Богов", "Новые зоны"],
  published_at: "2026-09-12T10:30:00+03:00",
  updated_at: "2026-09-13T16:45:00+03:00",
};
const forgedArticle: PublishedArticle = {
  id: "forged-static-fallback",
  title: fallbackHero.title,
  description: fallbackHero.description,
  label: fallbackHero.label,
  cover: { src: fallbackHero.cover, alt: fallbackHero.title },
  edition: "essence",
  category: "updates",
  slug: "forged-in-battle-vse-klassy-i-umeniya",
  tags: ["Essence", "Special Project", "Классы и умения", "Зоны и предметы"],
  published_at: fallbackHero.publishedAt,
  updated_at: fallbackHero.publishedAt,
};
const fallbackOnline: OnlineGroups = {
  Main: [{name:"Blackbird",online:4703},{name:"Elcardia",online:4902},{name:"Hatos",online:4155},{name:"Cadmus 2023",online:3063}],
  "Special Project": [{name:"Wolf1",online:1813},{name:"Wolf2",online:2047},{name:"Eva1",online:1943},{name:"Eva2",online:1690},{name:"Samurai1",online:1728},{name:"Samurai2",online:1438}],
  Essence: [{name:"Amethyst",online:1038},{name:"Peach",online:1937},{name:"Lilac",online:1506}],
};
const iconMap = { classes: Swords, skills: Sparkles, zones: Map, items: Box, guides: BookOpen, calculators: Calculator };
const gameLinks = [
  { name: "Main", short: "MN", tag: "Большой мир и клановая игра", text: "Классическая Lineage 2 в максимальном масштабе: развивай героя, покоряй Свержение и сражайся за влияние вместе с кланом.", cta: "Начать играть в Main", url: "https://ru.4game.com/s2s/lineage2_RedPlay", image: "/game-main.webp" },
  { name: "Essence", short: "ES", tag: "Высокий темп и конкуренция", text: "Быстрое развитие, автоматическая охота и постоянная борьба за лучшие места. Собери сильный билд и заяви о себе в PvP.", cta: "Начать играть в Essence", url: "https://4ga.me/3m0Ho3F", image: "/game-essence.webp" },
  { name: "Special Project", short: "SP", tag: "Фарм и честный прогресс", text: "Развивай персонажа через охоту и добычу адены, собирай экипировку в игре и двигайся вперёд без L-монет.", cta: "Начать в Special Project", url: "https://ru.4game.com/s2s/redplay_eva", image: "/game-special.webp", featured: true },
];
const fallbackVideos: Video[] = [
  { id: "5Gk5mmBJQ0A", title: "Апнул все камни 8 уровня на 1 млрд! Боевая мощь взлетела", url: "https://www.youtube.com/watch?v=5Gk5mmBJQ0A", thumbnail: "https://i.ytimg.com/vi/5Gk5mmBJQ0A/hqdefault.jpg", published: "RedPlay" },
  { id: "eJQ8OaBT2Ug", title: "Какой класс выбрать новичку в Lineage 2", url: "https://www.youtube.com/watch?v=eJQ8OaBT2Ug", thumbnail: "https://i.ytimg.com/vi/eJQ8OaBT2Ug/hqdefault.jpg", published: "RedPlay" },
  { id: "_qeKLeVCvPs", title: "Арбалетчика переработали: новый топ PvE-класс?", url: "https://www.youtube.com/watch?v=_qeKLeVCvPs", thumbnail: "https://i.ytimg.com/vi/_qeKLeVCvPs/hqdefault.jpg", published: "RedPlay" },
];
const heroSlides = [
  { kicker: "КОРЕЯ • БОЛЬШОЕ ОБНОВЛЕНИЕ", title: "FORGED IN BATTLE", text: "Все изменения классов, новые зоны и предметы — разобрали, перевели и собрали в одном месте.", cta: "Читать патчноут", tone: "red" },
  { kicker: "REDPLAY ORIGINAL", title: "ПУТЬ ДИВЕРСАНТА", text: "Большой разбор нового класса: билд, экипировка, навыки и реальный потенциал в PvE.", cta: "Смотреть разбор", tone: "violet" },
  { kicker: "СТАРТ С БОНУСАМИ", title: "ВЫБЕРИ СВОЮ ИГРУ", text: "Main, Essence или Special Project — коротко объясняем разницу и даём бонус на старт.", cta: "Начать играть", tone: "amber" },
];

export default function Home() {
  const savedEdition = useSyncExternalStore(
    subscribeToEditionPreference,
    () => editionLabels[readEditionPreference()],
    () => "Все версии",
  );
  const [selectedEdition, setSelectedEdition] = useState<Edition | null>(null);
  const edition = selectedEdition || savedEdition;
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusPromptOpen, setBonusPromptOpen] = useState(false);
  const [bonusGroup, setBonusGroup] = useState<BonusGroup>("Main");
  const [isMobile, setIsMobile] = useState(false);
  const [videos, setVideos] = useState<Video[]>(fallbackVideos);
  const [onlineEdition, setOnlineEdition] = useState<OnlineEdition>("Main");
  const [onlineGroups, setOnlineGroups] = useState<OnlineGroups>(fallbackOnline);
  const [onlineUpdated, setOnlineUpdated] = useState("обновляем сейчас");
  const [publishedArticles, setPublishedArticles] = useState<PublishedArticle[]>([]);
  const editionRef = useRef(edition);

  useEffect(() => {
    editionRef.current = edition;
  }, [edition]);

  const selectEdition = (selectedEdition: Edition) => {
    setSelectedEdition(selectedEdition);
    saveEditionPreference(editionValues[selectedEdition]);
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(media.matches);
    const initialUpdate = window.setTimeout(update, 0);
    media.addEventListener("change", update);
    return () => {
      window.clearTimeout(initialUpdate);
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    fetch("/api/youtube").then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.videos?.length) setVideos(data.videos.slice(0, 3));
    }).catch(() => undefined);
    fetch("/api/online").then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.groups) setOnlineGroups(data.groups);
      if (data?.updatedAt) setOnlineUpdated(new Date(data.updatedAt).toLocaleTimeString("ru", {hour:"2-digit", minute:"2-digit"}));
    }).catch(() => undefined);
    try {
      const supabase = createClient();
      supabase.from("articles").select("id,title,description,label,cover,edition,category,slug,tags,published_at,updated_at").eq("status", "published").order("published_at", { ascending: false }).limit(20).then(({ data }) => {
        if (data?.length) setPublishedArticles(data as PublishedArticle[]);
      });
    } catch {
      // The hand-picked cards below remain available if Supabase is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const dismissedAt = Number(localStorage.getItem("redplay-bonus-seen") || 0);
    const convertedAt = Number(localStorage.getItem("redplay-bonus-converted") || 0);

    if (
      sessionStorage.getItem("redplay-bonus-auto-shown") === "1" ||
      now - dismissedAt < sevenDays ||
      now - convertedAt < thirtyDays
    ) return;

    let activeSeconds = 0;
    let hasReachedScrollDepth = false;
    let handled = false;

    const showOffer = () => {
      if (handled || sessionStorage.getItem("redplay-bonus-auto-shown") === "1") return;
      const mobile = window.matchMedia("(max-width: 760px)").matches;
      const minimumSeconds = mobile ? 7 : 15;
      const maximumSeconds = mobile ? 25 : 40;
      if (activeSeconds < minimumSeconds || (!hasReachedScrollDepth && activeSeconds < maximumSeconds)) return;

      handled = true;
      sessionStorage.setItem("redplay-bonus-auto-shown", "1");
      const preferredGroup: BonusGroup = editionRef.current === "Main" ? "Main" : "Essence / Special Project";
      setBonusGroup(preferredGroup);

      if (window.matchMedia("(max-width: 760px)").matches) setBonusPromptOpen(true);
      else setBonusOpen(true);
    };

    const checkScrollDepth = () => {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const mobile = window.matchMedia("(max-width: 760px)").matches;
      const requiredDepth = mobile ? 0.2 : 0.3;
      if (scrollableHeight > 0 && window.scrollY / scrollableHeight >= requiredDepth) hasReachedScrollDepth = true;
      showOffer();
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") activeSeconds += 1;
      showOffer();
    }, 1000);

    window.addEventListener("scroll", checkScrollDepth, { passive: true });
    checkScrollDepth();

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", checkScrollDepth);
    };
  }, []);

  const openBonus = (group?: BonusGroup) => {
    const selectedGroup = group || (edition === "Main" ? "Main" : "Essence / Special Project");
    setBonusGroup(selectedGroup);
    localStorage.setItem("redplay-bonus-group", selectedGroup);
    sessionStorage.setItem("redplay-bonus-auto-shown", "1");
    setBonusPromptOpen(false);
    setBonusOpen(true);
  };

  const closeBonus = (open: boolean) => {
    setBonusOpen(open);
    if (!open) {
      setBonusPromptOpen(false);
      localStorage.setItem("redplay-bonus-seen", String(Date.now()));
    }
  };

  const closeBonusPrompt = () => {
    setBonusPromptOpen(false);
    localStorage.setItem("redplay-bonus-seen", String(Date.now()));
  };

  const selectBonusGroup = (group: BonusGroup) => {
    setBonusGroup(group);
    localStorage.setItem("redplay-bonus-group", group);
  };

  const followBonusLink = (gameName: string) => () => {
      const group: BonusGroup = gameName === "Main" ? "Main" : "Essence / Special Project";
      localStorage.setItem("redplay-bonus-converted", String(Date.now()));
      localStorage.setItem("redplay-bonus-group", group);
      setBonusPromptOpen(false);
      setBonusOpen(false);
    };

  useEffect(() => {
    if (!bonusOpen || !isMobile) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeBonus(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [bonusOpen, isMobile]);
  const editionArticles = useMemo(() => {
    const pool = [...publishedArticles, forgedArticle, replicaArticle]
      .filter((article, index, all) => {
        const href = `/lineage-2/${article.edition}/${article.category}/${article.slug}`;
        return all.findIndex((item) => `/lineage-2/${item.edition}/${item.category}/${item.slug}` === href) === index;
      })
      .sort((left, right) => new Date(right.published_at || right.updated_at).getTime() - new Date(left.published_at || left.updated_at).getTime());

    return pool.filter((article) => {
      if (edition === "Все версии") return true;
      if (edition === "Main") return article.edition === "main";
      return article.edition === "essence" || article.edition === "special-project";
    });
  }, [edition, publishedArticles]);

  const featuredStory = editionArticles[0] || (edition === "Main" ? replicaArticle : forgedArticle);
  const results = useMemo(() => {
    const posts = editionArticles.slice(1, 4).map((article) => {
      const targets = article.tags?.filter((tag) => tag === "Essence" || tag === "Special Project") || [];
      const targetLabel = targets.length === 2 ? "Essence + Special" : targets[0];
      return {
        category: `${articleCategories.find((item) => item.value === article.category)?.label || article.category}${targetLabel ? ` · ${targetLabel}` : ""}`,
        date: new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(article.published_at || article.updated_at)),
        title: article.title,
        summary: article.description,
        href: `/lineage-2/${article.edition}/${article.category}/${article.slug}`,
      };
    });
    const value = query.trim().toLocaleLowerCase("ru");
    return value ? posts.filter((post) => [post.title, post.category, post.summary].some((text) => text.toLocaleLowerCase("ru").includes(value))) : posts;
  }, [editionArticles, query]);
  const selectedServers = onlineGroups[onlineEdition];
  const totalOnline = selectedServers.reduce((sum, server) => sum + server.online, 0);
  const maxOnline = Math.max(...selectedServers.map(server => server.online), 1);
  const latestHero = publishedArticles[0];
  const heroHref = latestHero ? `/lineage-2/${latestHero.edition}/${latestHero.category}/${latestHero.slug}` : fallbackHero.href;
  const heroCover = latestHero?.cover?.src || fallbackHero.cover;
  const heroTitle = latestHero?.title || fallbackHero.title;
  const heroDescription = latestHero?.description || fallbackHero.description;
  const heroEdition = latestHero ? (latestHero.edition === "main" ? "Lineage 2 Main" : latestHero.edition === "essence" ? "Lineage 2 Essence" : "Lineage 2 Special Project") : "Lineage 2 Essence";
  const heroCategory = latestHero ? articleCategories.find((item) => item.value === latestHero.category)?.label || latestHero.label : fallbackHero.label;
  const heroTags = latestHero?.tags?.filter((tag) => tag !== "Essence" && tag !== "Special Project").slice(0, 3) || ["Классы и умения", "Зоны и предметы"];
  const heroDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(latestHero?.published_at || latestHero?.updated_at || fallbackHero.publishedAt));
  const featuredHref = `/lineage-2/${featuredStory.edition}/${featuredStory.category}/${featuredStory.slug}`;
  const featuredCover = featuredStory.cover?.src || (featuredStory.edition === "main" ? "/game-main.webp" : featuredStory.edition === "essence" ? "/game-essence.webp" : "/game-special.webp");
  const featuredCategory = articleCategories.find((item) => item.value === featuredStory.category)?.label || featuredStory.label;
  const featuredDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(featuredStory.published_at || featuredStory.updated_at));
  const featuredEdition = featuredStory.edition === "main" ? "Main" : featuredStory.edition === "essence" ? "Essence" : "Special Project";
  const featuredTags = featuredStory.tags?.filter((tag) => tag !== "Essence" && tag !== "Special Project").slice(0, 4) || [];

  const editionPath = edition === "Essence / Special Project" ? "essence" : "main";

  return <main className="min-h-screen overflow-hidden bg-background text-foreground">
    <h1 className="sr-only">Lineage 2 – новости, обновления, гайды и база знаний</h1>
    {!isMobile && <Dialog open={bonusOpen} onOpenChange={closeBonus}>
      <DialogContent className="bonus-dialog max-h-[92vh] overflow-y-auto border-0 p-0 sm:max-w-5xl" aria-describedby="bonus-description">
        <div className="bonus-dialog-head px-6 py-7 sm:px-8">
          <p className="portal-kicker"><Gift size={14}/> Бонус новым и вернувшимся</p>
          <DialogHeader className="mt-3 text-left"><DialogTitle className="text-3xl font-black tracking-[-.04em] text-white sm:text-4xl">Выбери свою Lineage 2</DialogTitle><DialogDescription id="bonus-description" className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Main — отдельная версия. Essence и Special Project работают на общей основе, но предлагают разные правила серверов и отдельные ссылки регистрации.</DialogDescription></DialogHeader>
        </div>
        <div className="bonus-desktop-groups" aria-hidden="true"><span>Main</span><span>Essence / Special Project</span></div>
        <div className="bonus-dialog-cards grid gap-3 p-4 sm:grid-cols-3 sm:p-6">{gameLinks.map(game => {
          return <a key={game.name} href={game.url} target="_blank" rel="sponsored noopener noreferrer" onClick={followBonusLink(game.name)} className={`bonus-choice ${game.featured ? "bonus-choice-featured" : ""}`}><span className="bonus-choice-art"><img src={game.image} alt=""/><span/></span><span className="relative z-10 flex h-full flex-col p-4"><span className="game-code">{game.short}</span><span className="choice-copy"><span className="choice-tag">{game.tag}</span><h3>{game.name}</h3><p>{game.text}</p><span className="choice-cta">{game.cta} <ArrowUpRight size={16}/></span></span></span>{game.featured && <span className="choice-label">Рекомендуем</span>}</a>;
        })}</div>
        <div className="bonus-dialog-footer"><p>Переходы ведут по партнёрским ссылкам RedPlay. Условия бонуса определяет 4game.</p><button type="button" onClick={() => closeBonus(false)}>Продолжить без выбора</button></div>
      </DialogContent>
    </Dialog>}

    {isMobile && bonusOpen && createPortal(<div className="bonus-sheet-portal">
      <button type="button" className="bonus-sheet-overlay" onClick={() => closeBonus(false)} aria-label="Закрыть выбор версии"/>
      <section className="bonus-sheet" role="dialog" aria-modal="true" aria-labelledby="bonus-sheet-title" aria-describedby="bonus-sheet-description">
        <div className="bonus-sheet-head">
          <p className="portal-kicker"><Gift size={14}/> Бонус новым и вернувшимся</p>
          <h2 id="bonus-sheet-title">Выбери свою Lineage 2</h2>
          <p id="bonus-sheet-description">Main — отдельная версия. Essence и Special Project имеют разные правила серверов и отдельные ссылки регистрации.</p>
          <button type="button" className="bonus-sheet-close" onClick={() => closeBonus(false)} aria-label="Закрыть окно"><X size={20}/></button>
        </div>
        <div className="bonus-sheet-tabs" aria-label="Выбор версии">
          {(["Main", "Essence / Special Project"] as BonusGroup[]).map((group) => <button key={group} type="button" className={bonusGroup === group ? "active" : ""} onClick={() => selectBonusGroup(group)}>{group}</button>)}
        </div>
        <div className="bonus-sheet-cards">{gameLinks.filter((game) => bonusGroup === "Main" ? game.name === "Main" : game.name !== "Main").map((game) => <a key={game.name} href={game.url} target="_blank" rel="sponsored noopener noreferrer" onClick={followBonusLink(game.name)} className={`bonus-choice ${game.featured ? "bonus-choice-featured" : ""}`}><span className="bonus-choice-art"><img src={game.image} alt=""/><span/></span><span className="relative z-10 flex h-full flex-col p-4"><span className="game-code">{game.short}</span><span className="choice-copy"><span className="choice-tag">{game.tag}</span><h3>{game.name}</h3><p>{game.text}</p><span className="choice-cta">{game.cta} <ArrowUpRight size={16}/></span></span></span>{game.featured && <span className="choice-label">Рекомендуем</span>}</a>)}</div>
        <div className="bonus-sheet-footer"><p>Партнёрские ссылки RedPlay. Условия бонуса определяет 4game.</p><button type="button" onClick={() => closeBonus(false)}>Продолжить без выбора</button></div>
      </section>
    </div>, document.body)}

    {bonusPromptOpen && <aside className="bonus-mobile-prompt" role="dialog" aria-label="Бонус для игроков Lineage 2">
      <button type="button" className="bonus-prompt-close" onClick={closeBonusPrompt} aria-label="Закрыть предложение"><X size={19}/></button>
      <span className="bonus-prompt-icon"><Gift size={20}/></span>
      <span className="bonus-prompt-copy"><strong>Бонус на старте</strong><small>Выбери Main или два варианта Essence</small></span>
      <button type="button" className="bonus-prompt-action" onClick={() => openBonus()}>Выбрать <ArrowRight size={16}/></button>
    </aside>}

    <aside className={`social-dock ${bonusPromptOpen ? "social-dock-suspended" : ""}`} aria-label="Ссылки RedPlay">
      <div className="social-dock-brand"><span className="redplay-mark small">R</span><span><strong>REDPLAY</strong><small>Всегда на связи</small></span></div>
      <a href="https://www.youtube.com/@iRedP" target="_blank" rel="noopener noreferrer"><span className="dock-icon youtube"><Youtube size={19}/></span><span><strong>YouTube</strong><small>Ролики и стримы</small></span><ArrowUpRight size={14}/></a>
      <a href="https://t.me/redplay2022" target="_blank" rel="noopener noreferrer"><span className="dock-icon telegram"><Send size={18}/></span><span><strong>Telegram</strong><small>Новости и общение</small></span><ArrowUpRight size={14}/></a>
      <button onClick={() => openBonus()}><span className="dock-icon gift"><Gift size={18}/></span><span><strong>Бонусы</strong><small>Выбрать версию</small></span><ChevronRight size={14}/></button>
    </aside>

    <header className="portal-header sticky top-0 z-40"><div className="mx-auto flex h-[70px] max-w-[1500px] items-center gap-6 px-4 sm:px-6 lg:px-8">
      <a href="#top" className="flex shrink-0 items-center gap-3" aria-label="RedPlay — главная"><span className="redplay-mark">R</span><span><span className="redplay-word block">REDPLAY</span><span className="block text-[9px] font-bold uppercase tracking-[.28em] text-white/35">Игровой портал</span></span></a>
      <span className="hidden h-7 w-px bg-white/10 md:block"/>
      <nav className="hidden items-center gap-6 text-sm font-bold text-white/65 lg:flex"><Link className="nav-link" href="/lineage-2/main">Main</Link><Link className="nav-link" href="/lineage-2/essence">Essence / Special Project</Link><Link className="nav-link" href="/lineage-2/main/guides">Гайды</Link><a className="nav-link" href="#knowledge">База знаний</a><a className="nav-link" href="#videos">Видео</a></nav>
      <label className="header-search ml-auto hidden items-center gap-2 xl:flex"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по порталу" /></label>
      <a href="https://www.youtube.com/@iRedP" target="_blank" rel="noopener noreferrer" aria-label="YouTube RedPlay" className="hidden size-10 place-items-center rounded-full bg-white/6 text-white/70 transition hover:bg-white/12 hover:text-white sm:grid"><Youtube size={17}/></a><a href="https://t.me/redplay2022" target="_blank" rel="noopener noreferrer" aria-label="Telegram RedPlay" className="hidden size-10 place-items-center rounded-full bg-white/6 text-white/70 transition hover:bg-white/12 hover:text-white sm:grid"><Send size={17}/></a>
      <button onClick={() => openBonus()} className="bonus-button hidden sm:flex"><Gift size={16}/> Играть</button>
      <button className="ml-auto grid size-10 place-items-center rounded-full bg-white/8 text-white lg:hidden sm:ml-0" onClick={() => setMenuOpen(v => !v)} aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
    </div>{menuOpen && <nav className="mobile-nav lg:hidden"><button onClick={() => {openBonus();setMenuOpen(false)}}><Gift size={17}/> Играть с бонусами</button>{[["Main","/lineage-2/main"],["Essence / Special Project","/lineage-2/essence"],["Гайды","/lineage-2/main/guides"],["База знаний","#knowledge"],["Видео","#videos"]].map(([item,href]) => <a key={item} href={href} onClick={() => setMenuOpen(false)}>{item}</a>)}</nav>}</header>

    <section id="top" className="hero-stage">
      <img src={heroCover} alt="" className="hero-publication-backdrop" aria-hidden="true"/>
      <img src={heroCover} alt={latestHero?.cover?.alt || heroTitle} className="hero-publication-image"/>
      <div className="hero-publication-shade"/>
      <div className="relative z-10 mx-auto flex min-h-[650px] max-w-[1500px] items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative z-10 w-full lg:max-w-[60%]">
          <div className="flex items-center gap-3"><span className="live-dot"/><p className="portal-kicker">{heroEdition} · {heroCategory}</p></div>
          <p className="hero-article-title mt-4" role="heading" aria-level={2}>{heroTitle}</p>
          <p className="hero-article-description mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">{heroDescription}</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href={heroHref} className="hero-primary">Читать публикацию <ArrowRight size={18}/></Link><Link href="/lineage-2/essence/updates" className="hero-secondary"><Newspaper size={17}/> Все обновления</Link></div>
          <div className="hero-context"><span>{heroDate}</span>{heroTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>
      </div>
    </section>

    <div className="edition-bar"><div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8"><span className="mr-2 hidden shrink-0 text-[11px] font-black uppercase tracking-[.16em] text-white/35 sm:block">Материалы по версии</span>{editions.map(item => <button key={item} onClick={() => selectEdition(item)} className={`edition-tab ${edition===item?"edition-tab-active":""}`}><span className="edition-signal"/>{item}</button>)}<span className="ml-auto hidden shrink-0 items-center gap-2 text-xs text-white/35 lg:flex"><Flame size={14} className="text-[#ff344b]"/> Обновлено сегодня</span></div></div>

    <section id="updates" className="portal-section"><div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="section-heading"><div><p className="portal-kicker dark"><Newspaper size={14}/> В центре внимания</p><h2>Актуальное в Lineage 2</h2></div><div className="flex items-center gap-3"><label className="content-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={edition === "Все версии" ? "Поиск по всем версиям" : `Поиск в ${edition}`} /></label>{edition !== "Все версии" && <Link className="section-more" href={`/lineage-2/${editionPath}/news`}>Все материалы <ArrowRight size={16}/></Link>}</div></div>
      <div className={`news-layout mt-7 ${results.length ? "" : "news-layout-single"}`}>
        <article className="feature-story"><div className="story-art"><img src={featuredCover} alt={featuredStory.cover?.alt || featuredStory.title}/><div className="story-overlay"/></div><div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-8"><div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[.13em] text-white/55"><span className="story-badge">{featuredCategory}</span><span>{featuredDate}</span><span>• {featuredEdition}</span></div><h3>{featuredStory.title}</h3><p>{featuredStory.description}</p>{featuredTags.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{featuredTags.map(tag=><span key={tag} className="dark-tag">{tag}</span>)}</div>}<Link href={featuredHref} className="story-link">Читать материал <ArrowUpRight size={17}/></Link></div></article>
        {results.length > 0 && <div className="news-stack">{results.map((post,index)=><Link key={`${post.href}-${post.title}`} href={post.href} className={`news-card news-card-${index+1}`}><div className="flex items-center justify-between gap-3"><span className="news-category">{post.category}</span><span className="text-[11px] font-bold text-[#9297a3]">{post.date}</span></div><h3>{post.title}</h3><p>{post.summary}</p><span className="mt-auto flex items-center gap-2 pt-4 text-xs font-black uppercase tracking-[.08em]">Читать <ArrowRight size={14}/></span></Link>)}</div>}
      </div>
    </div></section>

    <section id="videos" className="video-section"><div className="mx-auto max-w-[1500px] px-4 py-14 sm:px-6 lg:px-8 lg:py-18"><div className="section-heading light"><div><p className="portal-kicker"><Youtube size={15}/> RedPlay на YouTube</p><h2>Смотри. Читай. Побеждай.</h2></div><a href="https://www.youtube.com/@iRedP" target="_blank" rel="noopener noreferrer" className="section-more light">Все видео <ArrowUpRight size={16}/></a></div><div className="video-grid mt-8">{videos.map((video,index)=><a key={video.id} href={video.url} target="_blank" rel="noopener noreferrer" className={`video-card ${index===0?"video-card-large":""}`}><span className="video-thumb"><img src={video.thumbnail} alt=""/><span className="video-shade"/><span className="video-play"><Play size={18} fill="currentColor"/></span><span className="video-index">0{index+1}</span></span><span className="mt-4 block text-base font-black leading-6 text-white group-hover:text-[#ff596b]">{video.title}</span><span className="mt-2 block text-xs font-bold uppercase tracking-wider text-white/35">{video.published || "RedPlay"}</span></a>)}</div></div></section>

    <section id="pulse" className="pulse-section"><div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-14 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8 lg:py-18">
      <a className="telegram-hub" href="https://t.me/redplay2022" target="_blank" rel="noopener noreferrer"><img src="/oni-redplay.webp" alt="Они – персонаж RedPlay"/><span className="telegram-hub-shade"/><span className="telegram-hub-content"><span className="telegram-hub-icon"><Send size={22}/></span><small>RedPlay в Telegram</small><strong>Новости без задержки</strong><p>Быстрые обновления, результаты тестов, голосования, промокоды и живое обсуждение с игроками.</p><span className="telegram-hub-action">Присоединиться <ArrowUpRight size={16}/></span></span></a>
      <div className="pulse-panel"><div className="pulse-head"><div><p className="portal-kicker dark"><Activity size={14}/> Пульс RedPlay</p><h2>Официальные серверы онлайн</h2></div><div className="pulse-status"><span/><small>Оценочный онлайн<br/>обновлено в {onlineUpdated}</small></div></div><div className="online-tabs">{(["Main","Special Project","Essence"] as OnlineEdition[]).map(item=><button key={item} onClick={()=>setOnlineEdition(item)} className={onlineEdition===item?"is-active":""}>{item}</button>)}</div><div className="online-summary"><span><Activity size={18}/> Сейчас в игре</span><strong>{totalOnline.toLocaleString("ru")}</strong></div><div className="server-list">{selectedServers.map(server=><div key={server.name}><div><strong>{server.name}</strong><span>{server.online.toLocaleString("ru")}</span></div><i><span style={{width:`${Math.max(12, server.online / maxOnline * 100)}%`}}/></i></div>)}</div><div className="pulse-update"><Bell size={16}/><span><strong>Replica: предварительный полный разбор опубликован</strong><small>Следим за изменениями и дополняем материал.</small></span><Link href="/lineage-2/main/updates/replica">Открыть <ArrowRight size={14}/></Link></div></div>
    </div></section>

    <section id="knowledge" className="portal-section"><div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8"><div className="section-heading"><div><p className="portal-kicker dark"><Database size={14}/> База знаний</p><h2>Всё, что нужно для игры</h2></div><p className="max-w-md text-sm leading-6 text-[#777c88]">Lineage 2 – первая большая глава. Архитектура портала готова принимать новые игры и разделы.</p></div><div className="knowledge-grid mt-8">{knowledgeSections.map((section,index)=>{const Icon=iconMap[section.icon];return <Link key={section.title} href={`/lineage-2/${editionPath}/${section.href}`} className="knowledge-card"><span className="knowledge-number">0{index+1}</span><span className="knowledge-icon"><Icon size={23}/></span><h3>{section.title}</h3><p>{section.description}</p><span className="knowledge-link">Открыть раздел <ArrowUpRight size={16}/></span></Link>})}</div></div></section>

    <section className="portal-section pt-0"><div className="mx-auto grid max-w-[1500px] gap-5 px-4 sm:px-6 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
      <div className="bonus-strip"><div><p className="portal-kicker"><Gift size={14}/> Для новых и вернувшихся игроков</p><h2>Месяц расходников — на старте</h2><p>Выбери подходящую версию игры и начни с подарками от RedPlay.</p></div><button onClick={()=>openBonus()}>Выбрать версию <ArrowRight size={17}/></button></div>
      <div id="tools" className="tools-panel"><div className="flex items-center justify-between"><div><p className="portal-kicker dark"><Calculator size={14}/> Инструменты</p><h3>Сначала посчитай</h3></div><span className="soon">Скоро</span></div><div className="tool-list">{[{icon:Crosshair,title:"Фарм"},{icon:Shield,title:"Классы"},{icon:Sparkles,title:"Заточка"},{icon:Clock3,title:"Прокачка"}].map(({icon:Icon,title})=><a key={title} href="#tools"><Icon size={17}/><span>{title}</span></a>)}</div></div>
    </div></section>

    <footer><div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-9 text-sm text-white/38 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><div className="flex items-center gap-3"><span className="redplay-mark small">R</span><strong className="text-white">REDPLAY</strong><span>Игровой портал</span></div><div className="flex gap-5"><a href="https://www.youtube.com/@iRedP" target="_blank" rel="noopener noreferrer">YouTube</a><a href="https://t.me/redplay2022" target="_blank" rel="noopener noreferrer">Telegram</a></div><p>Lineage II – товарный знак NCSOFT.</p></div></footer>
  </main>;
}
