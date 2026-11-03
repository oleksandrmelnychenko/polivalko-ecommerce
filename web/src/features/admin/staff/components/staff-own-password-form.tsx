"use client";

import { useState, type FormEvent } from "react";
import { forgetCsrf } from "@/shared/admin/csrf";
import { Field } from "@/shared/admin/form/field";
import { FormStatus } from "@/shared/admin/form/form-status";
import { SaveButton } from "@/shared/admin/form/save-button";
import { useAdminForm } from "@/shared/admin/form/use-admin-form";
import { changeOwnPassword } from "../api/client";
import { passwordHelp } from "../lib/roles";

export function StaffOwnPasswordForm({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void } = {}) {
  const form = useAdminForm();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeat, setRepeat] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== repeat) {
      form.invalid({ repeat: ["Паролі не збігаються."] });
      return;
    }
    const result = await form.submit((headers) => changeOwnPassword(headers, { currentPassword, newPassword }), {
      done: "Пароль змінено.",
      failed: "Пароль не змінено.",
    });
    if (!result) return;
    forgetCsrf();
    setCurrentPassword("");
    setNewPassword("");
    setRepeat("");
    onDone?.();
  }

  return (
    <form className="admin-form" onSubmit={onSubmit} noValidate aria-label="Змінити мій пароль">
      <Field id="current-password" label="Поточний пароль" errors={form.errors.currentPassword}>
        {(a11y) => (
          <input {...a11y} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        )}
      </Field>
      <Field id="new-own-password" label="Новий пароль" help={passwordHelp} errors={form.errors.newPassword}>
        {(a11y) => <input {...a11y} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />}
      </Field>
      <Field id="repeat-own-password" label="Новий пароль ще раз" errors={form.errors.repeat}>
        {(a11y) => <input {...a11y} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />}
      </Field>
      <FormStatus form={form} />
      <div className="admin-actions">
        <SaveButton busy={form.busy}>Змінити пароль</SaveButton>
        {onCancel && (
          <button type="button" className="btn btn--small btn--quiet" onClick={onCancel}>
            Скасувати
          </button>
        )}
      </div>
    </form>
  );
}
