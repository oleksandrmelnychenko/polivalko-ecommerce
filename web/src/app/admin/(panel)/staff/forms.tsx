"use client";

import { useState, type FormEvent } from "react";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { forgetCsrf } from "@/lib/admin";
import { Field, FormStatus, SaveButton, useAdminForm, type FieldA11y } from "../content/_lib";

export type StaffUser = components["schemas"]["StaffUserDto"];
export type Role = "Admin" | "Manager";

export const roleLabel: Record<Role, string> = { Admin: "Адміністратор", Manager: "Менеджер" };
export const roleOf = (user: StaffUser): Role => (user.roles.includes("Admin") ? "Admin" : "Manager");

const passwordHelp = "Щонайменше 10 символів.";

function RoleSelect({ value, onChange, ...a11y }: FieldA11y & { value: Role; onChange: (role: Role) => void }) {
  return (
    <select {...a11y} value={value} onChange={(e) => onChange(e.target.value as Role)}>
      {Object.entries(roleLabel).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function CreateUserForm({ onCreated, onCancel }: { onCreated: (user: StaffUser) => void; onCancel: () => void }) {
  const form = useAdminForm();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("Manager");
  const [password, setPassword] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await form.submit(
      (headers) => browserApi.POST("/api/v1/admin/users", { headers, body: { email: email.trim(), displayName: displayName.trim(), role, password } }),
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
    <form className="admin-form" onSubmit={onSubmit} noValidate aria-label="Новий працівник">
      <Field id="new-email" label="Робочий email" errors={form.errors.email}>
        {(a11y) => <input {...a11y} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />}
      </Field>
      <Field id="new-name" label="Ім'я" help="Видно в історії замовлень і журналі." errors={form.errors.displayName}>
        {(a11y) => <input {...a11y} autoComplete="off" maxLength={100} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />}
      </Field>
      <Field id="new-role" label="Роль" errors={form.errors.role}>
        {(a11y) => <RoleSelect {...a11y} value={role} onChange={setRole} />}
      </Field>
      <Field id="new-password" label="Початковий пароль" help={passwordHelp} errors={form.errors.password}>
        {(a11y) => <input {...a11y} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
      </Field>
      <FormStatus form={form} />
      <div className="admin-actions">
        <SaveButton busy={form.busy}>Додати працівника</SaveButton>
        <button type="button" className="btn btn--small btn--quiet" onClick={onCancel}>
          Скасувати
        </button>
      </div>
    </form>
  );
}

export function EditUserForm({ user, onSaved, onCancel }: { user: StaffUser; onSaved: (user: StaffUser) => void; onCancel: () => void }) {
  const form = useAdminForm();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState(roleOf(user));
  const id = (field: string) => `${field}-${user.id}`;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await form.submit(
      (headers) => browserApi.PUT("/api/v1/admin/users/{id}", { params: { path: { id: user.id } }, headers, body: { displayName: displayName.trim(), role } }),
      { done: "Збережено.", failed: "Зміни не збережено." },
    );
    if (result?.data) onSaved(result.data);
  }

  return (
    <form className="admin-form admin-inline-form" onSubmit={onSubmit} noValidate aria-label={`Дані працівника ${user.email}`}>
      <div className="admin-grid">
        <Field id={id("name")} label="Ім'я" errors={form.errors.displayName}>
          {(a11y) => <input {...a11y} maxLength={100} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
        </Field>
        <Field id={id("role")} label="Роль" help="Зміна ролі завершує активні сесії працівника." errors={form.errors.role}>
          {(a11y) => <RoleSelect {...a11y} value={role} onChange={setRole} />}
        </Field>
      </div>
      <FormStatus form={form} />
      <div className="admin-actions">
        <SaveButton busy={form.busy} />
        <button type="button" className="btn btn--small btn--quiet" onClick={onCancel}>
          Скасувати
        </button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ user, onDone, onCancel }: { user: StaffUser; onDone: () => void; onCancel: () => void }) {
  const form = useAdminForm();
  const [password, setPassword] = useState("");
  const fieldId = `password-${user.id}`;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await form.submit(
      (headers) => browserApi.POST("/api/v1/admin/users/{id}/password", { params: { path: { id: user.id } }, headers, body: { password } }),
      { done: "Пароль змінено.", failed: "Пароль не змінено." },
    );
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

/** Власний пароль може змінити будь-який працівник, зокрема менеджер. */
export function OwnPasswordForm({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void } = {}) {
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
    const result = await form.submit((headers) => browserApi.POST("/api/v1/admin/auth/password", { headers, body: { currentPassword, newPassword } }), {
      done: "Пароль змінено.",
      failed: "Пароль не змінено.",
    });
    if (!result) return;
    // Сервер перевипустив cookie входу: наступна зміна візьме новий CSRF-токен.
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
