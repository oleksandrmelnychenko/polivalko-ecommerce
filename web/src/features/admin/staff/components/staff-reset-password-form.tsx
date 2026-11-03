"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/shared/admin/form/field";
import { FormStatus } from "@/shared/admin/form/form-status";
import { SaveButton } from "@/shared/admin/form/save-button";
import { useAdminForm } from "@/shared/admin/form/use-admin-form";
import { resetPassword } from "../api/client";
import { passwordHelp, type StaffUser } from "../lib/roles";

export function StaffResetPasswordForm({ user, onDone, onCancel }: { user: StaffUser; onDone: () => void; onCancel: () => void }) {
  const form = useAdminForm();
  const [password, setPassword] = useState("");
  const fieldId = `password-${user.id}`;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await form.submit((headers) => resetPassword(headers, user.id, { password }), {
      done: "Пароль змінено.",
      failed: "Пароль не змінено.",
    });
    if (result) onDone();
  }

  return (
    <form className="admin-form admin-inline-form" onSubmit={onSubmit} noValidate aria-label={`Новий пароль для ${user.email}`}>
      <Field id={fieldId} label={`Новий пароль для ${user.displayName}`} help={`${passwordHelp} Активні сесії працівника завершаться.`} errors={form.errors.password}>
        {(a11y) => <input {...a11y} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <FormStatus form={form} />
      <div className="admin-actions">
        <SaveButton busy={form.busy}>Змінити пароль</SaveButton>
        <button type="button" className="btn btn--small btn--quiet" onClick={onCancel}>
          Скасувати
        </button>
      </div>
    </form>
  );
}
