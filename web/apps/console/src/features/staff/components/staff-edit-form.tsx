"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/shared/form/field";
import { FormStatus } from "@/shared/form/form-status";
import { SaveButton } from "@/shared/form/save-button";
import { useConsoleForm } from "@/shared/form/use-console-form";
import { updateUser } from "../api/client";
import { roleOf, type StaffUser } from "../lib/roles";
import { StaffRoleSelect } from "./staff-role-select";

export function StaffEditForm({ user, onSaved, onCancel }: { user: StaffUser; onSaved: (user: StaffUser) => void; onCancel: () => void }) {
  const form = useConsoleForm();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState(roleOf(user));
  const id = (field: string) => `${field}-${user.id}`;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await form.submit((headers) => updateUser(headers, user.id, { displayName: displayName.trim(), role }), {
      done: "Збережено.",
      failed: "Зміни не збережено.",
    });
    if (result?.data) onSaved(result.data);
  }

  return (
    <form className="console-form console-inline-form" onSubmit={onSubmit} noValidate aria-label={`Дані працівника ${user.email}`}>
      <div className="console-grid">
        <Field id={id("name")} label="Ім'я" errors={form.errors.displayName}>
          {(a11y) => <input {...a11y} maxLength={100} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
        </Field>
        <Field id={id("role")} label="Роль" help="Зміна ролі завершує активні сесії працівника." errors={form.errors.role}>
          {(a11y) => <StaffRoleSelect {...a11y} value={role} onChange={setRole} />}
        </Field>
      </div>
      <FormStatus form={form} />
      <div className="console-actions">
        <SaveButton busy={form.busy} />
        <button type="button" className="btn btn--small btn--quiet" onClick={onCancel}>
          Скасувати
        </button>
      </div>
    </form>
  );
}
