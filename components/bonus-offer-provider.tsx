"use client";

import { ArrowRight, ArrowUpRight, Gift, X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type BonusGroup = "Main" | "Essence / Special Project";

type BonusOfferContextValue = {
  openBonus: (group?: BonusGroup) => void;
  promptOpen: boolean;
};

const BonusOfferContext = createContext<BonusOfferContextValue | null>(null);

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const STORAGE_KEYS = {
  seen: "redplay-bonus-seen",
  converted: "redplay-bonus-converted",
  group: "redplay-bonus-group",
  autoShown: "redplay-bonus-auto-shown",
} as const;

const gameLinks = [
  { name: "Main", short: "MN", tag: "Большой мир и клановая игра", text: "Классическая Lineage 2 в максимальном масштабе: развивай героя, покоряй Свержение и сражайся за влияние вместе с кланом.", cta: "Начать играть в Main", url: "https://ru.4game.com/s2s/lineage2_RedPlay", image: "/game-main.webp" },
  { name: "Essence", short: "ES", tag: "Высокий темп и конкуренция", text: "Быстрое развитие, автоматическая охота и постоянная борьба за лучшие места. Собери сильный билд и заяви о себе в PvP.", cta: "Начать играть в Essence", url: "https://4ga.me/3m0Ho3F", image: "/game-essence.webp" },
  { name: "Special Project", short: "SP", tag: "Фарм и честный прогресс", text: "Развивай персонажа через охоту и добычу адены, собирай экипировку в игре и двигайся вперёд без L-монет.", cta: "Начать в Special Project", url: "https://ru.4game.com/s2s/redplay_eva", image: "/game-special.webp", featured: true },
];

function readStorage(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // The offer remains usable when private browsing blocks persistent storage.
  }
}

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname === "/lineage-2" || pathname.startsWith("/lineage-2/");
}

function groupFromPath(pathname: string): BonusGroup | null {
  if (pathname === "/lineage-2/main" || pathname.startsWith("/lineage-2/main/")) return "Main";
  if (
    pathname === "/lineage-2/essence" ||
    pathname.startsWith("/lineage-2/essence/") ||
    pathname === "/lineage-2/special-project" ||
    pathname.startsWith("/lineage-2/special-project/") ||
    pathname === "/lineage-2/sp" ||
    pathname.startsWith("/lineage-2/sp/")
  ) return "Essence / Special Project";
  return null;
}

function savedGroup(): BonusGroup | null {
  const value = readStorage(window.localStorage, STORAGE_KEYS.group);
  return value === "Main" || value === "Essence / Special Project" ? value : null;
}

export function useBonusOffer() {
  const context = useContext(BonusOfferContext);
  if (!context) throw new Error("useBonusOffer must be used inside BonusOfferProvider");
  return context;
}

export function BonusOfferProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const publicPath = isPublicPath(pathname);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [bonusGroup, setBonusGroup] = useState<BonusGroup>("Main");
  const [isMobile, setIsMobile] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const chooseGroup = useCallback((requested?: BonusGroup) => {
    return requested || groupFromPath(pathname) || savedGroup() || "Main";
  }, [pathname]);

  const broadcastShown = useCallback(() => {
    channelRef.current?.postMessage("shown");
  }, []);

  const openBonus = useCallback((requested?: BonusGroup) => {
    if (!publicPath) return;
    const group = chooseGroup(requested);
    setBonusGroup(group);
    writeStorage(window.localStorage, STORAGE_KEYS.group, group);
    writeStorage(window.sessionStorage, STORAGE_KEYS.autoShown, "1");
    broadcastShown();
    setPromptOpen(false);
    setBonusOpen(true);
  }, [broadcastShown, chooseGroup, publicPath]);

  const closeBonus = useCallback((open: boolean) => {
    setBonusOpen(open);
    if (!open) {
      setPromptOpen(false);
      writeStorage(window.localStorage, STORAGE_KEYS.seen, String(Date.now()));
    }
  }, []);

  const closePrompt = useCallback(() => {
    setPromptOpen(false);
    writeStorage(window.localStorage, STORAGE_KEYS.seen, String(Date.now()));
  }, []);

  const selectGroup = useCallback((group: BonusGroup) => {
    setBonusGroup(group);
    writeStorage(window.localStorage, STORAGE_KEYS.group, group);
  }, []);

  const followBonusLink = useCallback((gameName: string) => () => {
    const group: BonusGroup = gameName === "Main" ? "Main" : "Essence / Special Project";
    writeStorage(window.localStorage, STORAGE_KEYS.converted, String(Date.now()));
    writeStorage(window.localStorage, STORAGE_KEYS.group, group);
    setPromptOpen(false);
    setBonusOpen(false);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("redplay-bonus-offer");
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data !== "shown") return;
      writeStorage(window.sessionStorage, STORAGE_KEYS.autoShown, "1");
      setPromptOpen(false);
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!publicPath) return;

    const now = Date.now();
    const dismissedAt = Number(readStorage(window.localStorage, STORAGE_KEYS.seen) || 0);
    const convertedAt = Number(readStorage(window.localStorage, STORAGE_KEYS.converted) || 0);
    if (
      readStorage(window.sessionStorage, STORAGE_KEYS.autoShown) === "1" ||
      now - dismissedAt < SEVEN_DAYS ||
      now - convertedAt < THIRTY_DAYS
    ) return;

    let activeSeconds = 0;
    let hasReachedScrollDepth = false;
    let handled = false;
    let timer: number | null = null;

    const stopWatching = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      window.removeEventListener("scroll", checkScrollDepth);
    };

    const showOffer = () => {
      if (handled || readStorage(window.sessionStorage, STORAGE_KEYS.autoShown) === "1") {
        stopWatching();
        return;
      }
      const mobile = window.matchMedia("(max-width: 760px)").matches;
      const minimumSeconds = mobile ? 7 : 15;
      const maximumSeconds = mobile ? 25 : 40;
      if (activeSeconds < minimumSeconds || (!hasReachedScrollDepth && activeSeconds < maximumSeconds)) return;

      handled = true;
      writeStorage(window.sessionStorage, STORAGE_KEYS.autoShown, "1");
      broadcastShown();
      setBonusGroup(chooseGroup());
      if (mobile) setPromptOpen(true);
      else setBonusOpen(true);
      stopWatching();
    };

    function checkScrollDepth() {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const mobile = window.matchMedia("(max-width: 760px)").matches;
      const requiredDepth = mobile ? 0.2 : 0.3;
      if (scrollableHeight > 0 && window.scrollY / scrollableHeight >= requiredDepth) hasReachedScrollDepth = true;
      showOffer();
    }

    timer = window.setInterval(() => {
      if (document.visibilityState === "visible") activeSeconds += 1;
      showOffer();
    }, 1000);
    window.addEventListener("scroll", checkScrollDepth, { passive: true });
    checkScrollDepth();

    return stopWatching;
  }, [broadcastShown, chooseGroup, publicPath]);

  useEffect(() => {
    if (publicPath) return;
    const reset = window.setTimeout(() => {
      setPromptOpen(false);
      setBonusOpen(false);
    }, 0);
    return () => window.clearTimeout(reset);
  }, [publicPath]);

  useEffect(() => {
    document.body.classList.toggle("bonus-offer-visible", promptOpen);
    return () => document.body.classList.remove("bonus-offer-visible");
  }, [promptOpen]);

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
  }, [bonusOpen, closeBonus, isMobile]);

  const contextValue = useMemo(() => ({ openBonus, promptOpen }), [openBonus, promptOpen]);

  return <BonusOfferContext.Provider value={contextValue}>
    {children}
    {publicPath && !isMobile && <Dialog open={bonusOpen} onOpenChange={closeBonus}>
      <DialogContent className="bonus-dialog max-h-[92vh] overflow-y-auto border-0 p-0 sm:max-w-5xl" aria-describedby="bonus-description">
        <div className="bonus-dialog-head px-6 py-7 sm:px-8">
          <p className="portal-kicker"><Gift size={14}/> Бонус новым и вернувшимся</p>
          <DialogHeader className="mt-3 text-left"><DialogTitle className="text-3xl font-black tracking-[-.04em] text-white sm:text-4xl">Выбери свою Lineage 2</DialogTitle><DialogDescription id="bonus-description" className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Main – отдельная версия. Essence и Special Project работают на общей основе, но предлагают разные правила серверов и отдельные ссылки регистрации.</DialogDescription></DialogHeader>
        </div>
        <div className="bonus-desktop-groups" aria-hidden="true"><span>Main</span><span>Essence / Special Project</span></div>
        <div className="bonus-dialog-cards grid gap-3 p-4 sm:grid-cols-3 sm:p-6">{gameLinks.map((game) => <a key={game.name} href={game.url} target="_blank" rel="sponsored noopener noreferrer" onClick={followBonusLink(game.name)} className={`bonus-choice ${game.featured ? "bonus-choice-featured" : ""}`}><span className="bonus-choice-art"><img src={game.image} alt=""/><span/></span><span className="relative z-10 flex h-full flex-col p-4"><span className="game-code">{game.short}</span><span className="choice-copy"><span className="choice-tag">{game.tag}</span><h3>{game.name}</h3><p>{game.text}</p><span className="choice-cta">{game.cta} <ArrowUpRight size={16}/></span></span></span>{game.featured && <span className="choice-label">Рекомендуем</span>}</a>)}</div>
        <div className="bonus-dialog-footer"><p>Переходы ведут по партнёрским ссылкам RedPlay. Условия бонуса определяет 4game.</p><button type="button" onClick={() => closeBonus(false)}>Продолжить без выбора</button></div>
      </DialogContent>
    </Dialog>}

    {publicPath && isMobile && bonusOpen && typeof document !== "undefined" && createPortal(<div className="bonus-sheet-portal">
      <button type="button" className="bonus-sheet-overlay" onClick={() => closeBonus(false)} aria-label="Закрыть выбор версии"/>
      <section className="bonus-sheet" role="dialog" aria-modal="true" aria-labelledby="bonus-sheet-title" aria-describedby="bonus-sheet-description">
        <div className="bonus-sheet-head">
          <p className="portal-kicker"><Gift size={14}/> Бонус новым и вернувшимся</p>
          <h2 id="bonus-sheet-title">Выбери свою Lineage 2</h2>
          <p id="bonus-sheet-description">Main – отдельная версия. Essence и Special Project имеют разные правила серверов и отдельные ссылки регистрации.</p>
          <button type="button" className="bonus-sheet-close" onClick={() => closeBonus(false)} aria-label="Закрыть окно"><X size={20}/></button>
        </div>
        <div className="bonus-sheet-tabs" aria-label="Выбор версии">
          {(["Main", "Essence / Special Project"] as BonusGroup[]).map((group) => <button key={group} type="button" className={bonusGroup === group ? "active" : ""} onClick={() => selectGroup(group)}>{group}</button>)}
        </div>
        <div className="bonus-sheet-cards">{gameLinks.filter((game) => bonusGroup === "Main" ? game.name === "Main" : game.name !== "Main").map((game) => <a key={game.name} href={game.url} target="_blank" rel="sponsored noopener noreferrer" onClick={followBonusLink(game.name)} className={`bonus-choice ${game.featured ? "bonus-choice-featured" : ""}`}><span className="bonus-choice-art"><img src={game.image} alt=""/><span/></span><span className="relative z-10 flex h-full flex-col p-4"><span className="game-code">{game.short}</span><span className="choice-copy"><span className="choice-tag">{game.tag}</span><h3>{game.name}</h3><p>{game.text}</p><span className="choice-cta">{game.cta} <ArrowUpRight size={16}/></span></span></span>{game.featured && <span className="choice-label">Рекомендуем</span>}</a>)}</div>
        <div className="bonus-sheet-footer"><p>Партнёрские ссылки RedPlay. Условия бонуса определяет 4game.</p><button type="button" onClick={() => closeBonus(false)}>Продолжить без выбора</button></div>
      </section>
    </div>, document.body)}

    {publicPath && promptOpen && <aside className="bonus-mobile-prompt" aria-label="Бонус для игроков Lineage 2">
      <button type="button" className="bonus-prompt-close" onClick={closePrompt} aria-label="Закрыть предложение"><X size={19}/></button>
      <span className="bonus-prompt-icon"><Gift size={20}/></span>
      <span className="bonus-prompt-copy"><strong>Бонус на старте</strong><small>Выбери Main или два варианта Essence</small></span>
      <button type="button" className="bonus-prompt-action" onClick={() => openBonus()}>Выбрать <ArrowRight size={16}/></button>
    </aside>}
  </BonusOfferContext.Provider>;
}
