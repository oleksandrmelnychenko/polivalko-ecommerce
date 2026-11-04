"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/shared/form/field";
import { FormStatus } from "@/shared/form/form-status";
import { SaveButton } from "@/shared/form/save-button";
import { useConsoleForm } from "@/shared/form/use-console-form";
import { createUser } from "../api/client";
import { passwordHelp, type Role, type StaffUser } from "../lib/roles";
import { StaffRoleSelect } from "./staff-role-select";

export function StaffCreateForm({ onCreated, onCancel }: { onCreated: (user: StaffUser) => void; onCancel: () => void }) {
  const form = useConsoleForm();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("Manager");
  const [password, setPassword] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await form.submit(
      (headers) => createUser(headers, { email: email.trim(), displayName: displayName.trim(), role, password }),
      { done: "Працівника додано. Передайте йому пароль особисто.", failed: "Працівника не додано." },
    );
    if (!result?.data) return;
    onCreated(result.data);
    setEmail("");
    setDisplayName("");
    setRole("Manager");
    setPassword("");
  }

  return (
    <form className="console-form" onSubmit={onSubmit} noValidate aria-label="Новий працівник">
      <Field id="new-email" label="Робочий email" errors={form.errors.email}>
        {(a11y) => <input {...a11y} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />}
      </Field>
      <Field id="new-name" label="Ім'я" help="Видно в історії замовлень і журналі." errors={form.errors.displayName}>
        {(a11y) => <input {...a11y} autoComplete="off" maxLength={100} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />}
      </Field>
      <Field id="new-role" label="Роль" errors={form.errors.role}>
        {(a11y) => <StaffRoleSelect {...a11y} value={role} onChange={setRole} />}
      </Field>
      <Field id="new-password" label="Початковий пароль" help={passwordHelp} errors={form.errors.password}>
        {(a11y) => <input {...a11y} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
      </Field>
      <FormStatus form={form} />
      <div className="console-actions">
        <SaveButton busy={form.busy}>Додати працівника</SaveButton>
        <button type="button" className="btn btn--small btn--quiet" onClick={onCancel}>
          Скасувати
        </button>
      </div>
    </form>
  );
}
