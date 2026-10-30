"use client";

import { useRef, useState, type FormEvent } from "react";
import type { ServiceDirection } from "@/lib/api/server";
import { browserApi, newIdempotencyKey, type Problem } from "@/lib/api/browser";

type State =
  | { status: "idle" | "sending" | "sent" }
  | { status: "error"; message: string; errors?: Record<string, string[]> };

/**
 * Форма звернення працює через той самий публічний API, що й майбутні мобільні застосунки:
 * звичайний POST /api/v1/service-requests без Server Actions (розділ 2 ТЗ).
 */
export function ServiceRequestForm({ directions }: { directions: ServiceDirection[] }) {
  const [state, setState] = useState<State>({ status: "idle" });
  // Один ключ на одну заявку: повторне натискання чи повтор після обриву зв'язку не створить дубль.
  const idempotencyKey = useRef<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    idempotencyKey.current ??= newIdempotencyKey();
    setState({ status: "sending" });

    try {
      const { response, error } = await browserApi.POST("/api/v1/service-requests", {
        params: { header: { "Idempotency-Key": idempotencyKey.current } },
        body: {
          name: String(data.get("name") ?? ""),
          phone: String(data.get("phone") ?? ""),
          direction: String(data.get("direction") ?? ""),
          comment: String(data.get("comment") ?? "") || null,
        },
      });

      if (response.ok) {
        idempotencyKey.current = null;
        form.reset();
        setState({ status: "sent" });
        return;
      }

      const problem = (error ?? {}) as Problem;
      if (problem.code === "idempotency.key_mismatch") idempotencyKey.current = null;
      setState({ status: "error", message: problem.title ?? "Не вдалося надіслати заявку. Спробуйте ще раз.", errors: problem.errors });
    } catch {
      setState({ status: "error", message: "Немає зв'язку з сервером. Перевірте інтернет і спробуйте ще раз." });
    }
  }

  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  const err = (key: string) => errors[key]?.[0];

  return (
    <form onSubmit={onSubmit} noValidate className="summary" aria-labelledby="request-title">
      <h2 id="request-title">Заявка на послугу</h2>

      <div className="field">
        <label htmlFor="name">Ім&apos;я</label>
        <input id="name" name="name" required autoComplete="name" maxLength={100} aria-invalid={Boolean(err("name"))} aria-describedby={err("name") ? "name-error" : undefined} />
        {err("name") && <p id="name-error" className="field__error">{err("name")}</p>}
      </div>

      <div className="field">
        <label htmlFor="phone">Телефон</label>
        <input id="phone" name="phone" type="tel" required inputMode="tel" autoComplete="tel" spellCheck={false} placeholder="+380 67 123 45 67" aria-invalid={Boolean(err("phone"))} aria-describedby={err("phone") ? "phone-error" : undefined} />
        {err("phone") && <p id="phone-error" className="field__error">{err("phone")}</p>}
      </div>

      <div className="field">
        <label htmlFor="direction">Напрямок</label>
        <select id="direction" name="direction" required defaultValue="" aria-invalid={Boolean(err("direction"))} aria-describedby={err("direction") ? "direction-error" : undefined}>
          <option value="" disabled>
            Оберіть напрямок
          </option>
          {directions.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
        {err("direction") && <p id="direction-error" className="field__error">{err("direction")}</p>}
      </div>

      <div className="field">
        <label htmlFor="comment">Коментар, якщо є</label>
        <textarea id="comment" name="comment" autoComplete="off" maxLength={1000} aria-invalid={Boolean(err("comment"))} />
      </div>

      <button type="submit" className="btn btn--wide" disabled={state.status === "sending"} aria-busy={state.status === "sending"}>
        {state.status === "sending" ? "Надсилаємо…" : "Замовити дзвінок"}
      </button>

      <div role="status" aria-live="polite">
        {state.status === "sent" && (
          <p className="notice notice--ok">Заявку отримано. Менеджер передзвонить, щоб домовитися про деталі.</p>
        )}
        {state.status === "error" && <p className="notice notice--error">{state.message}</p>}
      </div>
    </form>
  );
}
