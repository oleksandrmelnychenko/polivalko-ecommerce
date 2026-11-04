"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { sessionEnded, withCsrf } from "@/features/customer";
import { postResetPassword } from "../api/client";
import { useFormState } from "../hooks/use-form-state";
import { FormStatus } from "./form-status";
import { TextField } from "./text-field";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const formRef = useRef<HTMLFormElement>(null);
  const form = useFormState(formRef);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newPassword = String(new FormData(event.currentTarget).get("newPassword") ?? "");
    const result = await form.submit(() => withCsrf((h) => postResetPassword(h, { token, newPassword })));
    if (result?.response.ok) {
      sessionEnded();
      setDone(true);
    }
  }

  const tokenError = form.errors.token;

  return (
    <>
      <div aria-live="polite">
        {done && (
          <div className="auth__done">
            <p className="notice notice--ok">
              <strong>Пароль змінено</strong>
              Увійдіть з новим паролем. На інших пристроях теж потрібно буде увійти знову.
            </p>
            <Link href="/account/login" className="btn">
              Увійти
            </Link>
          </div>
        )}
      </div>
      {!done && !token && <BrokenLink text="У посиланні немає коду. Скопіюйте його з листа повністю або запросіть новий лист." />}
      {!done && token && (
        <form ref={formRef} className="auth__form" onSubmit={onSubmit} noValidate>
          {tokenError && <BrokenLink text={tokenError} />}
          <TextField name="newPassword" label="Новий пароль" type="password" autoComplete="new-password" required errors={form.errors} help="Щонайменше 8 символів." />
          <FormStatus status={tokenError ? null : form.status} />
          <button type="submit" className="btn btn--wide" disabled={form.busy} aria-busy={form.busy}>
            {form.busy ? "Зберігаємо…" : "Зберегти пароль"}
          </button>
        </form>
      )}
    </>
  );
}

function BrokenLink({ text }: { text: string }) {
  return (
    <p className="notice notice--error">
      <strong>Посилання не спрацювало</strong>
      {text}{" "}
      <Link href="/account/forgot-password" className="link">
        Надіслати новий лист
      </Link>
    </p>
  );
}
