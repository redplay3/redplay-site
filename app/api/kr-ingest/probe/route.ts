import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { probeKrSource } from "@/lib/kr/probe";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { url?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!payload.url) {
    return NextResponse.json({ error: "Укажи URL корейской публикации" }, { status: 400 });
  }

  try {
    const result = await probeKrSource(payload.url);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось определить источник" },
      { status: 400 },
    );
  }
}
