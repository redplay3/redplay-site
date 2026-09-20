import type { Metadata } from "next";
import "./globals.css";
import { BonusOfferProvider } from "@/components/bonus-offer-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { allSeoKeywords, DEFAULT_DESCRIPTION, DEFAULT_TITLE, safeJsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: "%s | RedPlay" },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "RedPlay", url: SITE_URL }],
  creator: "RedPlay",
  publisher: "RedPlay",
  keywords: allSeoKeywords,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: "/oni-redplay.webp", alt: "RedPlay – портал по Lineage 2" }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/oni-redplay.webp"],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    yandex: process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/favicon.svg`,
        sameAs: ["https://www.youtube.com/@iRedP", "https://t.me/redplay2022"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: "RedPlay – Lineage 2",
        description: DEFAULT_DESCRIPTION,
        inLanguage: "ru-RU",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };

  const themeBootScript = `(() => { try { const key = "redplay-theme"; const saved = localStorage.getItem(key); const mode = saved === "light" || saved === "dark" || saved === "system" ? saved : "system"; const admin = location.pathname.startsWith("/redplay-admin"); const theme = admin ? "light" : mode === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode; document.documentElement.dataset.themeMode = mode; document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; } catch (_) { document.documentElement.dataset.theme = "light"; } })();`;

  return <html lang="ru" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootScript }}/></head><body className="antialiased"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}/><ThemeProvider><BonusOfferProvider>{children}</BonusOfferProvider></ThemeProvider></body></html>;
}
