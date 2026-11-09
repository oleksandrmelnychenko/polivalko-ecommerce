"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { newIdempotencyKey } from "@polivalko/shared/api/browser";
import type { Problem } from "@polivalko/shared/api/problem";
import type { ServiceDirection } from "@polivalko/shared/api/types";
import { DropdownSelect } from "@/shared/ui/dropdown-select";
import { createServiceRequest } from "../api/client";
import { DIRECTION_EVENT } from "../lib/direction-event";

type State =
  | { status: "idle" | "sending" | "sent" }
  | { status: "error"; message: string; errors?: Record<string, string[]> };

export function ServiceRequestForm({ directions, className = "summary" }: { directions: ServiceDirection[]; className?: string; }) {
  const requested = useSearchParams().get("direction") ?? "";
  const preset = directions.some((d) => d.code === requested) ? requested : "";
  const [syncedPreset, setSyncedPreset] = useState(preset);
  const [direction, setDirection] = useState(preset);
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    const pick = (event: Event) => {
      const code = (event as CustomEvent<string>).detail;
      if (directions.some((d) => d.code === code)) setDirection(code);
    };
    window.addEventListener(DIRECTION_EVENT, pick);
    return () => window.removeEventListener(DIRECTION_EVENT, pick);
  }, [directions]);

  if (syncedPreset !== preset) {
    setSyncedPreset(preset);
    setDirection(preset);
  }
  const idempotencyKey = useRef<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    idempotencyKey.current ??= newIdempotencyKey();
    setState({ status: "sending" });

    try {
      const { response, error } = await createServiceRequest(idempotencyKey.current, {
        name: String(data.get("name") ?? ""),
        phone: String(data.get("phone") ?? ""),
        direction: String(data.get("direction") ?? ""),
        comment: String(data.get("comment") ?? "") || null,
      });

      if (response.ok) {
        idempotencyKey.current = null;
        form.reset();
        setDirection("");
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
    <form onSubmit={onSubmit} noValidate className={className} aria-labelledby="request-form-title">
      <h2 id="request-form-title">Ваші контакти</h2>

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
        <DropdownSelect
          id="direction"
          name="direction"
          variant="field"
          value={direction}
          placeholder="Оберіть напрямок"
          options={directions.map((d) => ({ value: d.code, label: d.name }))}
          onChange={setDirection}
          aria-invalid={Boolean(err("direction"))}
          aria-describedby={err("direction") ? "direction-error" : undefined}
        />
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
