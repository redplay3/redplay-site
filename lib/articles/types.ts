export type ArticleEdition = "main" | "essence" | "special-project";
export type ArticleAudience = "all" | "essence" | "special-project";

export type ArticleCategory =
  | "news"
  | "updates"
  | "guides"
  | "classes"
  | "skills"
  | "zones"
  | "items"
  | "comparisons"
  | "calculators";

export type ArticleIcon =
  | "alert"
  | "bell"
  | "crosshair"
  | "gem"
  | "globe"
  | "layers"
  | "map"
  | "shield"
  | "sparkles"
  | "swords";

type ArticleBlockContent =
  | { id: string; type: "paragraph"; text: string; lead?: boolean }
  | { id: string; type: "heading"; text: string; level: 2 | 3; kicker?: string; number?: string; anchor?: string }
  | { id: string; type: "list"; items: string[]; ordered?: boolean }
  | { id: string; type: "facts"; items: Array<{ value: string; label: string }> }
  | { id: string; type: "note"; title: string; text: string; icon?: ArticleIcon; compact?: boolean }
  | { id: string; type: "warning"; title: string; text: string }
  | { id: string; type: "cards"; items: Array<{ title: string; text: string; icon?: ArticleIcon }> }
  | { id: string; type: "table"; columns: string[]; rows: string[][]; compact?: boolean }
  | { id: string; type: "flow"; items: Array<{ title: string; subtitle?: string }> }
  | { id: string; type: "image"; src: string; alt: string; caption?: string }
  | { id: string; type: "disclosure"; title: string; items: string[] }
  | { id: string; type: "opinion"; text: string; image?: string; label?: string }
  | { id: string; type: "video"; title: string; text: string; url: string; source?: "youtube" | "file"; caption?: string; poster?: string; label?: string; action?: string }
  | { id: string; type: "telegram"; title: string; text: string; url?: string; label?: string; action?: string };

export type ArticleBlock = ArticleBlockContent & { scope?: ArticleAudience };

export type ArticleSection = {
  id: string;
  label: string;
  blocks: ArticleBlock[];
};

export type ArticleDocument = {
  id: string;
  game: "lineage-2";
  edition: ArticleEdition;
  category: ArticleCategory;
  slug: string;
  status: "draft" | "scheduled" | "published";
  title: string;
  description: string;
  cover: { src: string; alt: string };
  publishedAt: string;
  updatedAt: string;
  label: string;
  tags: string[];
  highlights: Array<{ icon: ArticleIcon; value: string; label: string }>;
  sections: ArticleSection[];
  seo?: { title?: string; description?: string; keywords?: string[] };
  videoUrl?: string;
};
