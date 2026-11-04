"use client";

import { useRef, type FormEvent } from "react";
import { setSignedIn, withCsrf, type CustomerMe } from "@/features/customer";
import { putProfile } from "../api/client";
import { useFormState } from "../hooks/use-form-state";
import { text } from "../lib/form-status";
import { FormStatus } from "./form-status";
import { TextField } from "./text-field";

export function ProfileForm({ me }: { me: CustomerMe }) {
  const formRef = useRef<HTMLFormElement>(null);
  const form = useFormState(formRef);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await form.submit(() => withCsrf((h) => putProfile(h, { name: text(data, "name"), phone: text(data, "phone") || null })));
    if (result?.data) {
      setSignedIn(result.data);
      form.setStatus({ kind: "ok", title: "Дані збережено" });
    }
  }

  return (
    <form ref={formRef} className="profile-card" onSubmit={onSubmit} noValidate aria-labelledby="profile-title">
      <h3 id="profile-title">Особисті дані</h3>
      <dl className="buybox__meta">
        <dt>Email</dt>
        <dd>
          {me.email}
          <span className={me.emailConfirmed ? "profile-card__badge" : "profile-card__badge profile-card__badge--wait"}>
            {me.emailConfirmed ? "підтверджено" : "не підтверджено"}
          </span>
        </dd>
      </dl>
      <TextField name="name" label="Ім'я та прізвище" autoComplete="name" maxLength={100} required defaultValue={me.name} errors={form.errors} />
      <TextField
        name="phone"
        label="Телефон"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+380 67 123 45 67"
        defaultValue={me.phone ?? ""}
        errors={form.errors}
        help="Підставимо його в оформлення замовлення."
      />
      <FormStatus status={form.status} />
      <button type="submit" className="btn" disabled={form.busy} aria-busy={form.busy}>
        {form.busy ? "Зберігаємо…" : "Зберегти"}
      </button>
    </form>
  );
}
