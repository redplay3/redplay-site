"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminSignOut() {
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/redplay-admin/login");
    router.refresh();
  };

  return <button type="button" className="admin-sign-out" onClick={signOut}><LogOut size={15}/> Выйти</button>;
}
