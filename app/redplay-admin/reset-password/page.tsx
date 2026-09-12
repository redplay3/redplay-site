"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Пароль должен содержать не менее 8 символов.");
    if (password !== confirmation) return setError("Пароли не совпадают.");
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace("/redplay-admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить пароль");
      setBusy(false);
    }
  };

  return <main className="admin-login"><form className="admin-login-card" onSubmit={updatePassword}>
    <span className="redplay-mark">R</span>
    <h1>Новый пароль</h1>
    <p>Задай новый пароль для входа в редакцию RedPlay.</p>
    <label className="admin-field"><span>Новый пароль</span><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required/></label>
    <label className="admin-field"><span>Повтори пароль</span><input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required/></label>
    {error && <div className="admin-error">{error}</div>}
    <button className="admin-primary" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить новый пароль"}</button>
  </form></main>;
}
