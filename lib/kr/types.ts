export type KrEdition = "essence" | "main";

export type KrSourceKind =
  | "plaync_update"
  | "plaync_notice"
  | "plaync_note"
  | "plaync_dictionary"
  | "plaync_feature"
  | "purple_lounge";

export type KrSourceDefinition = {
  id: string;
  label: string;
  host: string;
  pathPrefix: string;
  edition: KrEdition | null;
  kind: KrSourceKind;
  priority: "primary" | "structured" | "reference";
};

export type KrDetectedSource = {
  definition: KrSourceDefinition;
  articleId: string | null;
};

export type KrProbeMetrics = {
  bodyChars: number;
  tableCount: number;
  imageCount: number;
  headingCount: number;
  contentBlockCount: number;
};

export type KrLinkedPlayncSource = {
  url: string;
  label: string;
  edition: KrEdition | null;
  articleId: string | null;
};

export type KrIngestProbeResult = {
  ok: boolean;
  requestedUrl: string;
  finalUrl: string;
  source: KrDetectedSource;
  feedId: string | null;
  resolvedEdition: KrEdition | null;
  resolvedArticleId: string | null;
  linkedPlaync: KrLinkedPlayncSource | null;
  httpStatus: number;
  contentType: string | null;
  fetchedAt: string;
  title: string | null;
  contentHash: string | null;
  metrics: KrProbeMetrics;
  error?: string;
};
