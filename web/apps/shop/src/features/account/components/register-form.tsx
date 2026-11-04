"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { safeNext, signUp, useCustomer } from "@/features/customer";
import { useFormState } from "../hooks/use-form-state";
import { text } from "../lib/form-status";
import { withNext } from "../lib/with-next";
import { FormStatus } from "./form-status";
import { RegisterDone } from "./register-done";
import { TextField } from "./text-field";

export function RegisterForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const customer = useCustomer();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useFormState(formRef);
  const [email, setEmail] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await form.submit(() =>
      signUp({ name: text(data, "name"), email: text(data, "email"), phone: text(data, "phone") || null, password: String(data.get("password") ?? "") }),
    );
    if (result?.data) setEmail(result.data.email);
  }

  const signedInBefore = customer.status === "signedIn" && !email;

  return (
    <>
      <div aria-live="polite">{email && <RegisterDone email={email} next={next} />}</div>
      {signedInBefore && (
        <p className="notice">
          <strong>Ви вже увійшли</strong>
          <Link href="/account" className="link">
            Перейти до кабінету
          </Link>
        </p>
      )}
      {!email && !signedInBefore && (
        <form ref={formRef} className="auth__form" onSubmit={onSubmit} noValidate>
          <TextField name="name" label="Ім'я та прізвище" autoComplete="name" maxLength={100} required errors={form.errors} />
          <TextField name="email" label="Email" type="email" autoComplete="email" spellCheck={false} required errors={form.errors} />
          <TextField
            name="phone"
            label="Телефон, якщо хочете"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+380 67 123 45 67"
            errors={form.errors}
            help="Підставимо його в оформлення замовлення."
          />
          <TextField name="password" label="Пароль" type="password" autoComplete="new-password" required errors={form.errors} help="Щонайменше 8 символів." />
          <FormStatus status={form.status} />
          <button type="submit" className="btn btn--wide" disabled={form.busy} aria-busy={form.busy}>
            {form.busy ? "Створюємо…" : "Створити кабінет"}
          </button>
          <p className="field__help">
            Натискаючи кнопку, ви погоджуєтеся з{" "}
            <Link href="/privacy" className="link" target="_blank">
              політикою приватності
            </Link>
            .
          </p>
          <p className="auth__switch">
            Вже маєте кабінет?{" "}
            <Link href={withNext("/account/login", params)} className="link">
              Увійти
            </Link>
          </p>
        </form>
      )}
    </>
  );
}
