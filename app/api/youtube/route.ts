const CHANNEL_URL = "https://www.youtube.com/@iRedP";

function decode(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export async function GET() {
  try {
    const channelPage = await fetch(CHANNEL_URL, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 1800 } });
    const html = await channelPage.text();
    const channelId = html.match(/"channelId":"(UC[^"]+)"/)?.[1] || html.match(/channel_id=(UC[^"&]+)/)?.[1];
    if (!channelId) throw new Error("Channel id not found");
    const feed = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { next: { revalidate: 1800 } });
    const xml = await feed.text();
    const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 3).map((match) => {
      const entry = match[1];
      const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || "";
      const title = decode(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "Новое видео RedPlay");
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] || "";
      return { id, title, published, url: `https://www.youtube.com/watch?v=${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    }).filter((video) => video.id);
    if (!videos.length) throw new Error("No videos");
    return Response.json({ videos }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } });
  } catch {
    return Response.json({ videos: [] }, { status: 200, headers: { "Cache-Control": "public, s-maxage=300" } });
  }
}
