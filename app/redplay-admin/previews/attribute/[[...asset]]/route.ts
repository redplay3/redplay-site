import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
};

const documents: Record<string, string> = {
  "index.html": "text/html; charset=utf-8",
  "style.css": "text/css; charset=utf-8",
  "data.js": "text/javascript; charset=utf-8",
  "core.js": "text/javascript; charset=utf-8",
  "app.js": "text/javascript; charset=utf-8",
};

export async function GET(request: Request, context: { params: Promise<{ asset?: string[] }> }) {
  const supabase = await createClient();
  if (!supabase) return new Response("Предпросмотр недоступен", { status: 503, headers: privateHeaders });

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return new Response(null, {
      status: 303,
      headers: { ...privateHeaders, Location: new URL("/redplay-admin/login", request.url).href },
    });
  }
  const { data: allowed, error: accessError } = await supabase.rpc("is_admin");
  if (accessError || allowed !== true) return new Response("Нет доступа", { status: 403, headers: privateHeaders });

  const { asset = [] } = await context.params;
  const filename = asset.length ? asset.join("/") : "index.html";
  const contentType = asset.length <= 1 && Object.hasOwn(documents, filename)
    ? documents[filename]
    : asset.length === 2 && asset[0] === "icons" && /^[a-zA-Z0-9_-]+\.webp$/.test(asset[1])
      ? "image/webp"
      : null;
  if (!contentType) return new Response("Не найдено", { status: 404, headers: privateHeaders });

  const { data: file, error: fileError } = await supabase.from("editor_preview_assets")
    .select("body_base64")
    .eq("preview_slug", "attribute-main-v11")
    .eq("asset_path", filename)
    .maybeSingle();
  if (fileError) return new Response("Предпросмотр недоступен", { status: 503, headers: privateHeaders });
  if (!file) return new Response("Не найдено", { status: 404, headers: privateHeaders });
  return new Response(new Uint8Array(Buffer.from(file.body_base64, "base64")), {
    headers: { ...privateHeaders, "Content-Type": contentType },
  });
}
