"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { newIdempotencyKey } from "@polivalko/shared/api/browser";
import type { Problem } from "@polivalko/shared/api/problem";
import type { ServiceDirection } from "@polivalko/shared/api/types";
import { track } from "@/features/analytics";
import { createServiceRequest } from "../api/client";
import { DIRECTION_EVENT } from "../lib/direction-event";

type State =
  | { status: "idle" | "sending" | "sent" }
  | { status: "error"; message: string; errors?: Record<string, string[]> };

export function ServiceRequestForm({ directions }: { directions: ServiceDirection[] }) {
  const requested = useSearchParams().get("direction") ?? "";
  const preset = directions.some((d) => d.code === requested) ? requested : "";
  const [syncedPreset, setSyncedPreset] = useState(preset);
  const [selected, setSelected] = useState<string[]>(preset ? [preset] : []);
  const [state, setState] = useState<State>({ status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const sending = useRef(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const pending = state.status === "sending";

  function beginDraft() {
    setState(previous => previous.status === "sent" ? { status: "idle" } : previous);
  }

  useEffect(() => {
    if (state.status === "error") formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  useEffect(() => {
    const pick = (event: Event) => {
      const code = (event as CustomEvent<string>).detail;
      if (!sending.current && directions.some((d) => d.code === code)) {
        setSelected(current => current.includes(code) ? current : [...current, code]);
        beginDraft();
      }
    };
    window.addEventListener(DIRECTION_EVENT, pick);
    return () => window.removeEventListener(DIRECTION_EVENT, pick);
  }, [directions]);

  if (syncedPreset !== preset) {
    setSyncedPreset(preset);
    setSelected(preset ? [preset] : []);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const [direction, ...additionalDirections] = data.getAll("direction").map(String);
    if (!direction) {
      setState({ status: "error", message: "Оберіть хоча б одну послугу.", errors: { direction: ["Оберіть хоча б одну послугу."] } });
      return;
    }
    if (!data.get("acceptPrivacy")) {
      setState({
        status: "error",
        message: "Потрібна згода на обробку персональних даних.",
        errors: { acceptPrivacy: ["Підтвердьте згоду з політикою приватності."] },
      });
      return;
    }
    const body = {
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      direction,
      additionalDirections,
      comment: String(data.get("comment") ?? "") || null,
    };
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.body !== fingerprint) attempt.current = { body: fingerprint, key: newIdempotencyKey() };
    sending.current = true;
    setState({ status: "sending" });

    try {
      const { response, error } = await createServiceRequest(attempt.current.key, body);

      if (response.ok) {
        track("generate_lead", {
          service_direction: direction,
          directions_count: 1 + additionalDirections.length,
        });
        attempt.current = null;
        form.reset();
        setSelected([]);
        setState({ status: "sent" });
        return;
      }

      const problem = (error ?? {}) as Problem;
      if (problem.code === "idempotency.key_mismatch") attempt.current = null;
      setState({ status: "error", message: problem.title ?? "Не вдалося надіслати заявку. Спробуйте ще раз.", errors: problem.errors });
    } catch {
      setState({ status: "error", message: "Немає зв’язку із сервером. Перевірте інтернет і спробуйте ще раз." });
    } finally {
      sending.current = false;
    }
  }

  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  const err = (key: string) => errors[key]?.[0];

  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={beginDraft} className="contact-request-form" aria-labelledby="contact-services-title">
      <div className="request-options">
        <div className="request-options__head">
          <h2 id="contact-services-title">Заявка на садові роботи</h2>
          {directions.length > 1 && (
            <button type="button" disabled={pending} onClick={() => {
              setSelected(selected.length === directions.length ? [] : directions.map(item => item.code));
              beginDraft();
            }}>
              {selected.length === directions.length ? "Зняти вибір" : "Обрати всі"}
            </button>
          )}
        </div>
        <fieldset disabled={pending} className="direction-list">
          <legend className="visually-hidden">Оберіть одну або кілька послуг</legend>
          {directions.map(({ code, name, description }) => (
            <label key={code}>
              <span id={`service-name-${code}`}>{name}</span>
              <input type="checkbox" name="direction" value={code} checked={selected.includes(code)}
                onChange={event => {
                  const checked = event.currentTarget.checked;
                  setSelected(current => checked ? [...current, code] : current.filter(item => item !== code));
                }} aria-invalid={Boolean(err("direction"))}
                aria-labelledby={`service-name-${code}`}
                aria-describedby={[err("direction") && "direction-error", description && `service-info-${code}`].filter(Boolean).join(" ") || undefined} />
              {description && <small id={`service-info-${code}`}>{description}</small>}
            </label>
          ))}
          {err("direction") && <p id="direction-error" className="field__error">{err("direction")}</p>}
        </fieldset>
      </div>
      <div className="request-fields">
        <header>
          <h3>Ваші контакти</h3>
          <p>Зателефонуємо в робочий час, щоб узгодити деталі.</p>
        </header>

        <div className="field">
          <label htmlFor="name">Ім&apos;я</label>
          <input id="name" name="name" readOnly={pending} required autoComplete="name" maxLength={100} aria-invalid={Boolean(err("name"))} aria-describedby={err("name") ? "name-error" : undefined} />
          {err("name") && <p id="name-error" className="field__error">{err("name")}</p>}
        </div>

        <div className="field">
          <label htmlFor="phone">Телефон</label>
          <input id="phone" name="phone" type="tel" readOnly={pending} required inputMode="tel" autoComplete="tel" spellCheck={false} placeholder="+380 67 123 45 67" aria-invalid={Boolean(err("phone"))} aria-describedby={err("phone") ? "phone-error" : undefined} />
          {err("phone") && <p id="phone-error" className="field__error">{err("phone")}</p>}
        </div>

        <div className="field">
          <label htmlFor="comment">Коментар (необов’язково)</label>
          <textarea id="comment" name="comment" readOnly={pending} autoComplete="off" maxLength={1000} aria-invalid={Boolean(err("comment"))} aria-describedby={err("comment") ? "comment-error" : undefined} />
          {err("comment") && <p id="comment-error" className="field__error">{err("comment")}</p>}
        </div>

        <div className="field">
          <label className="consent">
            <input
              type="checkbox"
              name="acceptPrivacy"
              required
              disabled={pending}
              aria-invalid={Boolean(err("acceptPrivacy"))}
              aria-describedby={err("acceptPrivacy") ? "privacy-error" : undefined}
            />
            <span>
              Погоджуюся з{" "}
              <Link href="/privacy" className="link" target="_blank" rel="noopener noreferrer">
                політикою приватності
              </Link>
            </span>
          </label>
          {err("acceptPrivacy") && <p id="privacy-error" className="field__error">{err("acceptPrivacy")}</p>}
        </div>

        <button type="submit" className="btn btn--wide btn--graphite" disabled={pending} aria-busy={pending}>
          {pending ? "Надсилаємо…" : "Надіслати заявку"}
        </button>

        <div role="status" aria-live="polite">
          {state.status === "sent" && (
            <p className="notice notice--ok">Заявку надіслано. Менеджер зателефонує, щоб уточнити деталі.</p>
          )}
          {state.status === "error" && <p className="notice notice--error">{state.message}</p>}
        </div>
      </div>
    </form>
  );
}
