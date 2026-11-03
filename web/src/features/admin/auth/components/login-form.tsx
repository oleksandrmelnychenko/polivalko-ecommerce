"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { forgetCsrf } from "@/shared/admin/csrf";
import type { Problem } from "@/shared/api/problem";
import { login } from "../api/client";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const { response, error: problem } = await login({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
    setBusy(false);
    if (response.ok) {
      forgetCsrf();
      router.replace(next?.startsWith("/admin") ? next : "/admin");
      return;
    }
    const p = problem as Problem | undefined;
    setError(
      p?.code === "auth.locked_out"
        ? "Забагато невдалих спроб. Обліковий запис тимчасово заблоковано, спробуйте за 15 хвилин."
        : response.status === 429
          ? "Забагато спроб. Зачекайте хвилину."
          : "Невірний email або пароль.",
    );
  }

  return (
    <form className="admin-login__card" onSubmit={onSubmit} noValidate>
      <p className="logo logo--dark" translate="no">
        PoliValko
      </p>
      <h1>Вхід для працівників</h1>
      <p className="admin-login__lead">Замовлення, каталог, контент і стан інтеграцій магазину.</p>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" spellCheck={false} required />
      </div>
      <div className="field">
        <label htmlFor="password">Пароль</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn--wide" disabled={busy} aria-busy={busy}>
        {busy ? "Входимо…" : "Увійти"}
      </button>
    </form>
  );
}
