"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      router.replace("/redplay-admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось выполнить вход");
      setBusy(false);
    }
  };

  return <main className="admin-login"><form className="admin-login-card" onSubmit={signIn}>
    <span className="redplay-mark">R</span>
    <h1>Редакция RedPlay</h1>
    <p>Закрытая панель для подготовки, оформления и публикации материалов.</p>
    <label className="admin-field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required/></label>
    <label className="admin-field"><span>Пароль</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label>
    {error && <div className="admin-error">{error}</div>}
    <button className="admin-primary" disabled={busy}>{busy ? "Входим…" : "Войти в редакцию"}</button>
  </form></main>;
}

