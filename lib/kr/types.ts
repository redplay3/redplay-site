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
};

export type KrIngestProbeResult = {
  ok: boolean;
  requestedUrl: string;
  finalUrl: string;
  source: KrDetectedSource;
  httpStatus: number;
  contentType: string | null;
  fetchedAt: string;
  title: string | null;
  contentHash: string | null;
  metrics: KrProbeMetrics;
  error?: string;
};
