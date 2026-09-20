"use client";

import { Check, Laptop, Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "redplay-theme";
const CHANGE_EVENT = "redplay-theme-change";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode, pathname: string): ResolvedTheme {
  const isAdmin = pathname.startsWith("/redplay-admin");
  const resolved = isAdmin ? "light" : mode === "system" ? systemTheme() : mode;
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

function readMode(): ThemeMode {
  const storedMode = window.localStorage.getItem(STORAGE_KEY);
  return isThemeMode(storedMode) ? storedMode : "system";
}

function themeSnapshot() {
  const documentMode = document.documentElement.dataset.themeMode || null;
  const mode = isThemeMode(documentMode) ? documentMode : "system";
  const resolved = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  return `${mode}:${resolved}`;
}

function subscribeToTheme(listener: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleThemeChange = () => listener();
  const handleSystemChange = () => {
    if (readMode() === "system") applyTheme("system", window.location.pathname);
    listener();
  };
  window.addEventListener(CHANGE_EVENT, handleThemeChange);
  media.addEventListener("change", handleSystemChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handleThemeChange);
    media.removeEventListener("change", handleSystemChange);
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
  { value: "system" as const, label: "Системная", icon: Laptop },
  { value: "light" as const, label: "Светлая", icon: Sun },
  { value: "dark" as const, label: "Тёмная", icon: Moon },
];

export function ThemeSwitcher({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const snapshot = useSyncExternalStore(subscribeToTheme, themeSnapshot, () => "system:light");
  const [modeValue, resolvedValue] = snapshot.split(":");
  const mode = isThemeMode(modeValue) ? modeValue : "system";
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
