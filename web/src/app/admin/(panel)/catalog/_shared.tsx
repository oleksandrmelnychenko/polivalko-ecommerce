"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Problem } from "@/lib/api/browser";
import { csrfHeader, forgetCsrf, useStaff } from "@/lib/admin";

const tabs = [
  { href: "/admin/catalog", label: "Товари", adminOnly: false },
  { href: "/admin/catalog/categories", label: "Розділи", adminOnly: true },
  { href: "/admin/catalog/collections", label: "Добірки головної", adminOnly: false },
  { href: "/admin/catalog/redirects", label: "Перенаправлення", adminOnly: true },
  { href: "/admin/catalog/import", label: "Імпорт", adminOnly: true },
];

/** Вкладки розділу «Каталог». Структуру, перенаправлення й імпорт бачить лише адміністратор. */
export function CatalogTabs() {
  const pathname = usePathname();
  const { isAdmin } = useStaff();
  return (
    <nav className="admin-tabs" aria-label="Розділи каталогу">
      {tabs
        .filter((t) => isAdmin || !t.adminOnly)
        .map((t) => {
          const current = t.href === "/admin/catalog" ? pathname === t.href || pathname.startsWith("/admin/catalog/products") : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={current ? "page" : undefined}>
              {t.label}
            </Link>
          );
        })}
    </nav>
  );
}

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useStaff();
  return isAdmin ? <>{children}</> : <p className="notice">Розділ доступний лише адміністратору.</p>;
}

type ApiResult<T> = { data?: T; error?: unknown; response: Response };

/**
 * Змінний запит адмінки з токеном CSRF: якщо токен застарів (новий вхід), береться свіжий
 * і запит повторюється один раз.
 */
export async function mutate<T>(send: (headers: { "X-CSRF-TOKEN": string }) => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  let result = await send(await csrfHeader());
  if ((result.error as Problem | undefined)?.code === "auth.csrf_invalid") {
    forgetCsrf();
    result = await send(await csrfHeader());
  }
  return result;
}

/** Помилки валідації Problem Details → перше повідомлення для кожного поля. */
export function fieldErrors(error: unknown): Record<string, string> {
  const problem = error as Problem | undefined;
  return Object.fromEntries(Object.entries(problem?.errors ?? {}).map(([k, v]) => [k, v[0]]));
}

export function problemTitle(error: unknown, fallback: string) {
  return (error as Problem | undefined)?.title ?? fallback;
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="field__error">
      {message}
    </p>
  ) : null;
}
