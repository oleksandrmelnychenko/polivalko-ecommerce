"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Problem } from "@/lib/api/browser";
import { csrfHeader, forgetCsrf, useStaff } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";

/* Спільне для екранів контенту, інтеграцій, працівників і журналу. */

/** Розділ лише для адміністратора: менеджер бачить пояснення замість помилки 403. */
export function AdminOnly({ title, children }: { title: string; children: ReactNode }) {
  const { isAdmin } = useStaff();
  if (isAdmin) return <>{children}</>;
  return (
    <>
      <h1 className="admin-title">{title}</h1>
      <p className="notice" role="status">
        Розділ доступний лише адміністратору.
      </p>
    </>
  );
}

const contentLinks = [
  { href: "/admin/content", label: "Сторінки" },
  { href: "/admin/content/contacts", label: "Контакти" },
  { href: "/admin/content/services", label: "Послуги" },
  { href: "/admin/content/pickup", label: "Самовивіз" },
];

export function ContentNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-subnav" aria-label="Розділи контенту">
      {contentLinks.map((l) => {
        const current = l.href === "/admin/content" ? pathname === l.href || pathname.startsWith("/admin/content/pages/") : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function when(iso: string | null | undefined): string {
  return iso ? formatDateTime(iso) : "—";
}

type CsrfHeaders = Awaited<ReturnType<typeof csrfHeader>>;

export const problemOf = (result: { error?: unknown }) => result.error as Problem | undefined;

/** Заголовок проблеми з поясненням, якщо API його дав (409 «не можна зняти з себе роль» тощо). */
export function problemText(problem: Problem | undefined, fallback: string): string {
  if (!problem?.title) return fallback;
  return problem.detail ? `${problem.title}. ${problem.detail}` : problem.title;
}

/** Змінний запит адмінки з CSRF-заголовком; застарілий токен оновлюємо й повторюємо запит один раз. */
export async function withCsrf<R extends { error?: unknown }>(send: (headers: CsrfHeaders) => Promise<R>): Promise<R> {
  let result = await send(await csrfHeader());
  if (problemOf(result)?.code === "auth.csrf_invalid") {
    forgetCsrf();
    result = await send(await csrfHeader());
  }
  return result;
}

type FormState = { busy: boolean; errors: Record<string, string[]>; error: string | null; done: string | null };

const idle: FormState = { busy: false, errors: {}, error: null, done: null };
const checkFields = "Перевірте виділені поля.";

/**
 * Стан форми адмінки: зайнятість, помилки полів з 400 (Problem Details `errors`),
 * заголовок інших проблем (404, 409) і повідомлення про успіх.
 */
export function useAdminForm() {
  const [state, setState] = useState<FormState>(idle);

  async function submit<R extends { error?: unknown; response: Response }>(
    send: (headers: CsrfHeaders) => Promise<R>,
    messages: { done: string; failed: string },
  ): Promise<R | null> {
    setState({ ...idle, busy: true });
    try {
      const result = await withCsrf(send);
      if (result.response.ok) {
        setState({ ...idle, done: messages.done });
        return result;
      }
      const problem = problemOf(result);
      setState({ ...idle, errors: problem?.errors ?? {}, error: problem?.errors ? checkFields : problemText(problem, messages.failed) });
    } catch {
      setState({ ...idle, error: "Немає зв'язку з сервером. Спробуйте ще раз." });
    }
    return null;
  }

  return {
    ...state,
    submit,
    /** Помилки, знайдені ще в браузері (напр. паролі не збігаються). */
    invalid: (errors: Record<string, string[]>) => setState({ ...idle, errors, error: checkFields }),
  };
}

export type FieldA11y = { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

/** Поле з міткою, підказкою й помилкою; помилку й підказку зв'язано з полем через aria-describedby. */
export function Field({
  id,
  label,
  help,
  errors,
  children,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  errors?: string[];
  children: (a11y: FieldA11y) => ReactNode;
}) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-invalid": errorId ? true : undefined, "aria-describedby": describedBy })}
      {errors?.length ? (
        <p id={errorId} className="field__error">
          {errors.join(" ")}
        </p>
      ) : null}
      {help && (
        <p id={helpId} className="field__help">
          {help}
        </p>
      )}
    </div>
  );
}

export function CheckField({
  id,
  label,
  checked,
  onChange,
  errors,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  errors?: string[];
}) {
  const errorId = errors?.length ? `${id}-error` : undefined;
  return (
    <div className="admin-check">
      <label className="check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={errorId}
        />
        {label}
      </label>
      {errors?.length ? (
        <p id={errorId} className="field__error">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function FormStatus({ form }: { form: { error: string | null; done: string | null } }) {
  if (form.error)
    return (
      <p className="notice notice--error" role="alert">
        {form.error}
      </p>
    );
  if (form.done)
    return (
      <p className="notice notice--ok" role="status">
        {form.done}
      </p>
    );
  return null;
}

export function SaveButton({ busy, disabled, children = "Зберегти" }: { busy: boolean; disabled?: boolean; children?: ReactNode }) {
  return (
    <button type="submit" className="btn btn--small" disabled={busy || disabled} aria-busy={busy}>
      {busy ? "Зберігаємо…" : children}
    </button>
  );
}
