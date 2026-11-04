"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { withCsrf } from "@/features/customer";
import { postForgotPassword } from "../api/client";
import { useFormState } from "../hooks/use-form-state";
import { text } from "../lib/form-status";
import { FormStatus } from "./form-status";
import { TextField } from "./text-field";

export function ForgotPasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const form = useFormState(formRef);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = text(new FormData(event.currentTarget), "email");
    const result = await form.submit(() => withCsrf((h) => postForgotPassword(h, email)));
    if (result?.response.ok) setSentTo(email);
  }

  return (
    <>
      <div aria-live="polite">
        {sentTo && (
          <div className="auth__done">
            <p className="notice notice--ok">
              <strong>Перевірте пошту</strong>
              Якщо кабінет з адресою <b>{sentTo}</b> існує, ми надіслали туди посилання для нового пароля. Лист може
              потрапити в «Спам».
            </p>
            <Link href="/account/login" className="btn btn--quiet">
              Повернутися до входу
            </Link>
          </div>
        )}
      </div>
      {!sentTo && (
        <form ref={formRef} className="auth__form" onSubmit={onSubmit} noValidate>
          <TextField name="email" label="Email кабінету" type="email" autoComplete="email" spellCheck={false} required errors={form.errors} />
          <FormStatus status={form.status} />
          <button type="submit" className="btn btn--wide" disabled={form.busy} aria-busy={form.busy}>
            {form.busy ? "Надсилаємо…" : "Надіслати посилання"}
          </button>
          <p className="auth__switch">
            Згадали пароль?{" "}
            <Link href="/account/login" className="link">
              Увійти
            </Link>
          </p>
        </form>
      )}
    </>
  );
}
