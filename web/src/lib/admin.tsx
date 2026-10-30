"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { browserApi } from "./api/browser";
import type { components } from "./api/schema";

export type StaffMe = components["schemas"]["StaffMeDto"];

/**
 * Адмінка працює на HttpOnly-cookie, яку ставить ASP.NET Core (браузер не бачить секрет).
 * Для змінних запитів API вимагає antiforgery-токен у заголовку X-CSRF-TOKEN (розділ 2 ТЗ).
 */
let csrfToken: string | null = null;

export async function csrfHeader(): Promise<{ "X-CSRF-TOKEN": string }> {
  if (!csrfToken) {
    const { data } = await browserApi.GET("/api/v1/admin/auth/csrf");
    csrfToken = data?.token ?? "";
  }
  return { "X-CSRF-TOKEN": csrfToken };
}

export function forgetCsrf() {
  csrfToken = null;
}

const StaffContext = createContext<{ me: StaffMe; isAdmin: boolean } | null>(null);

export function useStaff() {
  const value = useContext(StaffContext);
  if (!value) throw new Error("useStaff: немає StaffGate");
  return value;
}

/** Пускає в панель лише після входу; інакше веде на сторінку входу. */
export function StaffGate({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<StaffMe | null>(null);

  useEffect(() => {
    let cancelled = false;
    void browserApi.GET("/api/v1/admin/auth/me").then(({ data, response }) => {
      if (cancelled) return;
      if (data) setMe(data);
      else if (response.status === 401) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!me) return <>{fallback}</>;
  return <StaffContext.Provider value={{ me, isAdmin: me.roles.includes("Admin") }}>{children}</StaffContext.Provider>;
}

/**
 * Завантаження даних панелі з чотирма станами: завантаження, помилка, порожньо, дані.
 * `key` описує запит (фільтри з URL); під час перезавантаження лишаються попередні дані.
 */
export function useAdminData<T>(key: string, load: () => Promise<{ data?: T; response: Response }>) {
  const router = useRouter();
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ key: string | null; status: "error" | "ready"; data?: T }>({ key: null, status: "ready" });
  const current = `${key}#${nonce}`;
  const fetchData = useEffectEvent(load);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .then(({ data, response }) => {
        if (cancelled) return;
        if (response.status === 401) router.replace("/admin/login");
        else setState({ key: current, status: data ? "ready" : "error", data });
      })
      .catch(() => !cancelled && setState({ key: current, status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [current, router]);

  const status: "loading" | "error" | "ready" = state.key === current ? state.status : state.data ? "ready" : "loading";
  return {
    status,
    data: state.data,
    // Іде новий запит, а на екрані — попередні дані: їх показуємо приглушено, без скелетона й стрибка.
    pending: state.key !== current && state.data !== undefined,
    reload: () => setNonce((n) => n + 1),
    setData: (data: T) => setState({ key: current, status: "ready", data }),
  };
}
