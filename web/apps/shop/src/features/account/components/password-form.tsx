"use client";

import { useRef, type FormEvent } from "react";
import { withCsrf } from "@/features/customer";
import { postChangePassword } from "../api/client";
import { useFormState } from "../hooks/use-form-state";
import { FormStatus } from "./form-status";
import { TextField } from "./text-field";

export function PasswordForm({ email }: { email: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const form = useFormState(formRef);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const data = new FormData(target);
    const result = await form.submit(() =>
      withCsrf((h) => postChangePassword(h, { currentPassword: String(data.get("currentPassword") ?? ""), newPassword: String(data.get("newPassword") ?? "") })),
    );
    if (result?.response.ok) {
      target.reset();
      form.setStatus({ kind: "ok", title: "Пароль змінено", text: "На інших пристроях потрібно буде увійти знову." });
    }
  }

  return (
    <form ref={formRef} className="profile-card" onSubmit={onSubmit} noValidate aria-labelledby="password-title">
      <h3 id="password-title">Пароль</h3>
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <TextField name="currentPassword" label="Поточний пароль" type="password" autoComplete="current-password" required errors={form.errors} />
      <TextField name="newPassword" label="Новий пароль" type="password" autoComplete="new-password" required errors={form.errors} help="Щонайменше 8 символів." />
      <FormStatus status={form.status} />
      <button type="submit" className="btn" disabled={form.busy} aria-busy={form.busy}>
        {form.busy ? "Змінюємо…" : "Змінити пароль"}
      </button>
    </form>
  );
}
