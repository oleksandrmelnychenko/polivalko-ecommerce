"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/shared/form/field";
import { FormStatus } from "@/shared/form/form-status";
import { SaveButton } from "@/shared/form/save-button";
import { useConsoleForm } from "@/shared/form/use-console-form";
import { resetPassword } from "../api/client";
import { passwordHelp, type StaffUser } from "../lib/roles";

export function StaffResetPasswordForm({ user, onDone, onCancel }: { user: StaffUser; onDone: () => void; onCancel: () => void }) {
  const form = useConsoleForm();
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
    <form className="console-form console-inline-form" onSubmit={onSubmit} noValidate aria-label={`Новий пароль для ${user.email}`}>
      <Field id={fieldId} label={`Новий пароль для ${user.displayName}`} help={`${passwordHelp} Активні сесії працівника завершаться.`} errors={form.errors.password}>
        {(a11y) => <input {...a11y} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <FormStatus form={form} />
      <div className="console-actions">
        <SaveButton busy={form.busy}>Змінити пароль</SaveButton>
        <button type="button" className="btn btn--small btn--quiet" onClick={onCancel}>
          Скасувати
        </button>
      </div>
    </form>
  );
}
