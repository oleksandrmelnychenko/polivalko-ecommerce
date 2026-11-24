"use client";

import { useRef, type FormEvent } from "react";
import { updateCustomerDetails, withAccountCsrf, type CustomerMe } from "@/features/customer";
import { putProfile } from "../api/client";
import { useFormState } from "../hooks/use-form-state";
import { text } from "../lib/form-status";
import { FormStatus } from "./form-status";
import { TextField } from "./text-field";

export function ProfileForm({ me, onClose }: { me: CustomerMe; onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const editVersion = useRef(0);
  const form = useFormState(formRef);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const submittedVersion = editVersion.current;
    const result = await form.submit(() => withAccountCsrf((h) => putProfile(h, { name: text(data, "name"), phone: text(data, "phone") || null }), me.id));
    if (result?.data) {
      updateCustomerDetails(result.data);
      if (editVersion.current === submittedVersion) form.setStatus({ kind: "ok", title: "Дані збережено" });
    }
  }

  return (
    <form ref={formRef} className="profile-card" onSubmit={onSubmit} onChange={() => {
      editVersion.current += 1;
      if (form.status?.kind === "ok") form.setStatus(null);
    }} noValidate aria-labelledby="profile-title">
      <TextField name="name" label="Ім'я та прізвище" autoFocus autoComplete="name" maxLength={100} required defaultValue={me.name} errors={form.errors} />
      <TextField
        name="phone"
        label="Телефон"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+380 67 123 45 67"
        defaultValue={me.phone ?? ""}
        errors={form.errors}
        help="Використовуємо для зв’язку щодо замовлень."
      />
      <FormStatus status={form.status} />
      <div className="profile-actions">
        <button type="submit" className="btn btn--small" disabled={form.busy} aria-busy={form.busy}>
          {form.busy ? "Зберігаємо…" : "Зберегти"}
        </button>
        <button type="button" className="btn btn--quiet btn--small" onClick={onClose} disabled={form.busy}>
          {form.status?.kind === "ok" ? "Готово" : "Скасувати"}
        </button>
      </div>
    </form>
  );
}
