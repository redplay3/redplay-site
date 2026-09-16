const CHANNEL_VIDEOS_URL = "https://www.youtube.com/@iRedP/videos";

type Video = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  published: string;
};

type JsonRecord = Record<string, unknown>;

let lastKnownVideos: Video[] = [];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractInitialData(html: string): unknown {
  const marker = "var ytInitialData = ";
  const markerIndex = html.indexOf(marker);
  const start = html.indexOf("{", markerIndex + marker.length);
  if (markerIndex < 0 || start < 0) throw new Error("YouTube data not found");

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return JSON.parse(html.slice(start, index + 1));
  }

  throw new Error("YouTube data is incomplete");
}

function findVideoId(value: unknown): string {
  if (Array.isArray(value)) {
    for (const child of value) {
      const id = findVideoId(child);
      if (id) return id;
    }
    return "";
  }
  if (!isRecord(value)) return "";
  if (typeof value.videoId === "string") return value.videoId;
  for (const child of Object.values(value)) {
    const id = findVideoId(child);
    if (id) return id;
  }
  return "";
}

function collectVideos(value: unknown, videos: Video[], seen: Set<string>) {
  if (Array.isArray(value)) {
    for (const child of value) collectVideos(child, videos, seen);
    return;
  }
  if (!isRecord(value)) return;

  const lockup = value.lockupViewModel;
  if (isRecord(lockup)) {
    const metadata = isRecord(lockup.metadata) ? lockup.metadata.lockupMetadataViewModel : null;
    const metadataRecord = isRecord(metadata) ? metadata : null;
    const titleRecord = metadataRecord && isRecord(metadataRecord.title) ? metadataRecord.title : null;
    const title = titleRecord && typeof titleRecord.content === "string" ? titleRecord.content : "";
    const id = findVideoId(lockup);
    const isLive = /BADGE_STYLE_TYPE_LIVE_NOW|LIVE_STREAM|UPCOMING_EVENT/i.test(JSON.stringify(lockup));

    if (id && title && !isLive && !seen.has(id)) {
      const details = metadataRecord && isRecord(metadataRecord.metadata) ? metadataRecord.metadata.contentMetadataViewModel : null;
      const detailRecord = isRecord(details) ? details : null;
      const rows = Array.isArray(detailRecord?.metadataRows) ? detailRecord.metadataRows : [];
      const labels = rows.flatMap((row) => {
        if (!isRecord(row) || !Array.isArray(row.metadataParts)) return [];
        return row.metadataParts.flatMap((part) => {
          if (!isRecord(part) || !isRecord(part.text) || typeof part.text.content !== "string") return [];
          return [part.text.content];
        });
      });

      seen.add(id);
      videos.push({
        id,
        title,
        published: labels.at(-1) || "RedPlay",
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      });
    }
  }

  for (const child of Object.values(value)) collectVideos(child, videos, seen);
}

export async function GET() {
  try {
    const response = await fetch(CHANNEL_VIDEOS_URL, {
      headers: { "Accept-Language": "ru,en;q=0.8", "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error(`YouTube returned ${response.status}`);

    const videos: Video[] = [];
    collectVideos(extractInitialData(await response.text()), videos, new Set());
    if (videos.length < 3) throw new Error("Not enough full-length videos");

    lastKnownVideos = videos.slice(0, 3);
    return Response.json({ videos: lastKnownVideos }, {
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" },
    });
  } catch {
    if (lastKnownVideos.length) {
      return Response.json({ videos: lastKnownVideos, stale: true }, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" },
      });
    }
    return Response.json({ videos: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
