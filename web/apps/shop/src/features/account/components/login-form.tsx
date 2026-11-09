"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type FormEvent } from "react";
import { safeNext, signIn, useCustomer } from "@/features/customer";
import { useFormState } from "../hooks/use-form-state";
import { text } from "../lib/form-status";
import { withNext } from "../lib/with-next";
import { FormStatus } from "./form-status";
import { TextField } from "./text-field";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const reason = params.get("reason");
  const customer = useCustomer();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useFormState(formRef);

  useEffect(() => {
    if (customer.status === "signedIn") router.replace(next);
  }, [customer.status, next, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await form.submit(() => signIn({ email: text(data, "email"), password: String(data.get("password") ?? "") }));
  }

  return (
    <form ref={formRef} className="auth__form" onSubmit={onSubmit} noValidate>
      {reason === "favorites" && (
        <p className="notice">
          <strong>Обране доступне в кабінеті</strong>
          Увійдіть або зареєструйтеся, і збережені товари будуть доступні з будь-якого пристрою.
        </p>
      )}
      <TextField name="email" label="Email" type="email" autoComplete="email" spellCheck={false} required errors={form.errors} />
      <TextField
        name="password"
        label="Пароль"
        type="password"
        autoComplete="current-password"
        required
        errors={form.errors}
        aside={
          <Link href="/account/forgot-password" className="link">
            Забули пароль?
          </Link>
        }
      />
      <FormStatus status={form.status} />
      <button type="submit" className="btn btn--wide" disabled={form.busy} aria-busy={form.busy}>
        {form.busy ? "Входимо…" : "Увійти"}
      </button>
      <p className="auth__switch">
        Ще немає кабінету?{" "}
        <Link href={withNext("/account/register", params)} className="link">
          Зареєструватися
        </Link>
      </p>
    </form>
  );
}
