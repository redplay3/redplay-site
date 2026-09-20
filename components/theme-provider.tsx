"use client";

import { Check, Clock3, Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

type ThemeMode = "auto" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "redplay-theme";
const CHANGE_EVENT = "redplay-theme-change";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}

function timeTheme(date = new Date()): ResolvedTheme {
  const hour = date.getHours();
  return hour >= 7 && hour < 20 ? "light" : "dark";
}

function nextThemeBoundaryDelay(date = new Date()) {
  const next = new Date(date);
  const hour = date.getHours();
  if (hour < 7) next.setHours(7, 0, 0, 0);
  else if (hour < 20) next.setHours(20, 0, 0, 0);
  else {
    next.setDate(next.getDate() + 1);
    next.setHours(7, 0, 0, 0);
  }
  return Math.max(1_000, next.getTime() - date.getTime());
}

function applyTheme(mode: ThemeMode, pathname: string): ResolvedTheme {
  const isAdmin = pathname.startsWith("/redplay-admin");
  const resolved = isAdmin ? "light" : mode === "auto" ? timeTheme() : mode;
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

function readMode(): ThemeMode {
  const storedMode = window.localStorage.getItem(STORAGE_KEY);
  if (storedMode === "system") return "auto";
  return isThemeMode(storedMode) ? storedMode : "auto";
}

function themeSnapshot() {
  const documentMode = document.documentElement.dataset.themeMode || null;
  const mode = isThemeMode(documentMode) ? documentMode : "auto";
  const resolved = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  return `${mode}:${resolved}`;
}

function subscribeToTheme(listener: () => void) {
  let boundaryTimer = 0;
  const handleThemeChange = () => listener();
  const syncAutomaticTheme = () => {
    if (readMode() === "auto") applyTheme("auto", window.location.pathname);
    listener();
  };
  const scheduleNextBoundary = () => {
    window.clearTimeout(boundaryTimer);
    boundaryTimer = window.setTimeout(() => {
      syncAutomaticTheme();
      scheduleNextBoundary();
    }, nextThemeBoundaryDelay());
  };
  const handleVisibilityChange = () => {
    if (!document.hidden) syncAutomaticTheme();
  };
  scheduleNextBoundary();
  window.addEventListener(CHANGE_EVENT, handleThemeChange);
  window.addEventListener("focus", syncAutomaticTheme);
  window.addEventListener("storage", syncAutomaticTheme);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => {
    window.clearTimeout(boundaryTimer);
    window.removeEventListener(CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("focus", syncAutomaticTheme);
    window.removeEventListener("storage", syncAutomaticTheme);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

function updateTheme(mode: ThemeMode) {
  window.localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(mode, window.location.pathname);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    applyTheme(readMode(), pathname);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [pathname]);

  return children;
}

const options = [
  { value: "auto" as const, label: "Авто по времени", icon: Clock3 },
  { value: "light" as const, label: "Светлая", icon: Sun },
  { value: "dark" as const, label: "Тёмная", icon: Moon },
];

export function ThemeSwitcher({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const snapshot = useSyncExternalStore(subscribeToTheme, themeSnapshot, () => "auto:light");
  const [modeValue, resolvedValue] = snapshot.split(":");
  const mode = isThemeMode(modeValue) ? modeValue : "auto";
  const resolvedTheme: ResolvedTheme = resolvedValue === "dark" ? "dark" : "light";

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const ActiveIcon = resolvedTheme === "dark" ? Moon : Sun;

  return <div ref={rootRef} className={`theme-switcher ${className}`.trim()}>
    <button
      type="button"
      className="theme-switcher-trigger"
      aria-label="Выбрать оформление сайта"
      aria-haspopup="menu"
      aria-expanded={open}
      title={`Тема: ${options.find((option) => option.value === mode)?.label.toLowerCase()}`}
      onClick={() => setOpen((value) => !value)}
    >
      <ActiveIcon size={17}/><span className="theme-switcher-label">Тема</span>
    </button>
    {open && <div className="theme-switcher-menu" role="menu" aria-label="Оформление сайта">
      <span className="theme-switcher-title">Оформление</span>
      {options.map(({ value, label, icon: Icon }) => <button
        key={value}
        type="button"
        role="menuitemradio"
        aria-checked={mode === value}
        className={mode === value ? "is-active" : ""}
        onClick={() => { updateTheme(value); setOpen(false); }}
      >
        <Icon size={16}/><span>{label}</span>{mode === value && <Check size={15}/>}
      </button>)}
    </div>}
  </div>;
}
