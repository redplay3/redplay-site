import { redirect } from "next/navigation";
import { KrIngestProbe } from "@/components/admin/kr-ingest-probe";
import { createClient } from "@/lib/supabase/server";
import { AdminTopbar } from "../layout";

export default async function KrInboxPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/redplay-admin");

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/redplay-admin/login");

  const { data: allowed } = await supabase.rpc("is_admin");
  if (!allowed) redirect("/redplay-admin/login?error=access");

  return <main className="admin-shell">
    <AdminTopbar />
    <div className="admin-wrap">
      <div className="admin-head">
        <div>
          <h1>KR Inbox</h1>
          <p>Первый этап KR Ingest: ручная проверка официальных PLAYNC и Purple Lounge источников до подключения автоматического радара.</p>
        </div>
      </div>
      <KrIngestProbe />
    </div>
  </main>;
}
