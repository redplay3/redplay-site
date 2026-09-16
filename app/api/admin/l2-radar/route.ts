import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase не настроен" }, { status: 500 });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Нужна авторизация" }, { status: 401 });

  const { data: allowed, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || !allowed) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });

  const { data, error } = await supabase.functions.invoke("l2-ru-radar", { body: {} });
  if (error) return NextResponse.json({ error: error.message || "Ошибка радара" }, { status: 502 });

  return NextResponse.json(data || { ok: true });
}
