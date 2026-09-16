import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token || token.length < 32 || token.length > 160) {
    return NextResponse.json({ error: "Invalid handoff token" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabase.rpc("get_kr_chatgpt_handoff", { p_token_hash: tokenHash });
  if (error) return NextResponse.json({ error: "Handoff lookup failed" }, { status: 500 });
  if (!data) {
    return NextResponse.json(
      { error: "Handoff expired, revoked, or not found" },
      { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
    );
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
