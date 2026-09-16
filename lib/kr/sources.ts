import type { KrDetectedSource, KrSourceDefinition } from "./types";

export const KR_SOURCES: KrSourceDefinition[] = [
  {
    id: "essence-update",
    label: "PLAYNC Essence / Updates",
    host: "lineage2.plaync.com",
    pathPrefix: "/board/l2update/",
    edition: "essence",
    kind: "plaync_update",
    priority: "primary",
  },
  {
    id: "essence-notice",
    label: "PLAYNC Essence / Notices",
    host: "lineage2.plaync.com",
    pathPrefix: "/board/l2notice/",
    edition: "essence",
    kind: "plaync_notice",
    priority: "primary",
  },
  {
    id: "essence-note",
    label: "PLAYNC Essence / L2 Note",
    host: "lineage2.plaync.com",
    pathPrefix: "/board/l2note/",
    edition: "essence",
    kind: "plaync_note",
    priority: "primary",
  },
  {
    id: "main-update",
    label: "PLAYNC Main / Updates",
    host: "lineage2.plaync.com",
    pathPrefix: "/board/l2awknupdate/",
    edition: "main",
    kind: "plaync_update",
    priority: "primary",
  },
  {
    id: "main-notice",
    label: "PLAYNC Main / Notices",
    host: "lineage2.plaync.com",
    pathPrefix: "/board/l2awknnotice/",
    edition: "main",
    kind: "plaync_notice",
    priority: "primary",
  },
  {
    id: "main-note",
    label: "PLAYNC Main / L2 Note",
    host: "lineage2.plaync.com",
    pathPrefix: "/board/l2awknnote/",
    edition: "main",
    kind: "plaync_note",
    priority: "primary",
  },
  {
    id: "essence-dictionary",
    label: "PLAYNC Essence / Dictionary",
    host: "lineage2.plaync.com",
    pathPrefix: "/dic/l2/",
    edition: "essence",
    kind: "plaync_dictionary",
    priority: "reference",
  },
  {
    id: "main-dictionary",
    label: "PLAYNC Main / Dictionary",
    host: "lineage2.plaync.com",
    pathPrefix: "/dic/l2awkn/",
    edition: "main",
    kind: "plaync_dictionary",
    priority: "reference",
  },
  {
    id: "plaync-feature",
    label: "PLAYNC / Feature page",
    host: "lineage2.plaync.com",
    pathPrefix: "/conts/",
    edition: null,
    kind: "plaync_feature",
    priority: "primary",
  },
  {
    id: "purple-lounge",
    label: "NC Purple Lounge",
    host: "lounge.plaync.com",
    pathPrefix: "/feed/",
    edition: null,
    kind: "purple_lounge",
    priority: "structured",
  },
];

export function detectKrSource(input: string): KrDetectedSource {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Некорректный URL");
  }

  const definition = KR_SOURCES.find(
    (source) => source.host === url.hostname && url.pathname.startsWith(source.pathPrefix),
  );

  if (!definition) {
    throw new Error("URL не относится к поддерживаемому источнику PLAYNC / Purple Lounge");
  }

  return {
    definition,
    articleId: url.searchParams.get("articleId"),
  };
}
