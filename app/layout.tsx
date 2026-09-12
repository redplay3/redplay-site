import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://redplay.stream"),
  title: "RedPlay База — Lineage 2 Essence, Special Project и Main",
  description: "Информационная база RedPlay по Lineage 2: патчноуты, классы, умения, зоны охоты, предметы, гайды и калькуляторы.",
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body className="antialiased">{children}</body></html>;
}
