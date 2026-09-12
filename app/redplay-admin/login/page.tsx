"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);

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

  const sendRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const callback = `${window.location.origin}/auth/callback?next=/redplay-admin/reset-password`;
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: callback,
      });
      if (recoveryError) throw recoveryError;
      setNotice("Письмо отправлено. Открой ссылку из письма на этом устройстве.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отправить письмо");
    } finally {
      setBusy(false);
    }
  };

  return <main className="admin-login"><form className="admin-login-card" onSubmit={recovery ? sendRecovery : signIn}>
    <span className="redplay-mark">R</span>
    <h1>{recovery ? "Восстановление пароля" : "Редакция RedPlay"}</h1>
    <p>{recovery ? "Укажи email редактора – мы отправим ссылку для создания нового пароля." : "Закрытая панель для подготовки, оформления и публикации материалов."}</p>
    <label className="admin-field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required/></label>
    {!recovery && <label className="admin-field"><span>Пароль</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label>}
    {error && <div className="admin-error">{error}</div>}
    {notice && <div className="admin-success">{notice}</div>}
    <button className="admin-primary" disabled={busy}>{busy ? "Подождите…" : recovery ? "Отправить письмо" : "Войти в редакцию"}</button>
    <button className="admin-link-button" type="button" onClick={() => { setRecovery(!recovery); setError(""); setNotice(""); }}>
      {recovery ? "Вернуться ко входу" : "Забыли пароль?"}
    </button>
  </form></main>;
}
