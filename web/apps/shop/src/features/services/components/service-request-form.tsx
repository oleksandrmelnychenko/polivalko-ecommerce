"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, type FormEvent, type ReactNode } from "react";
import { newIdempotencyKey } from "@polivalko/shared/api/browser";
import type { Problem } from "@polivalko/shared/api/problem";
import type { ServiceDirection } from "@polivalko/shared/api/types";
import { CloseIcon } from "@polivalko/shared/ui/icons";
import { createServiceRequest } from "../api/client";
import { DIRECTION_EVENT } from "../lib/direction-event";

type State =
  | { status: "idle" | "sending" | "sent" }
  | { status: "error"; message: string; errors?: Record<string, string[]> };

type Props = { directions: ServiceDirection[]; intro: ReactNode };

export function ServiceRequestForm({ directions, intro }: Props) {
  const requested = useSearchParams().get("direction") ?? "";
  const preset = directions.find(item => item.code === requested)?.code ?? "";
  return <RequestWizard key={requested} directions={directions} intro={intro} preset={preset} linked={Boolean(requested)} />;
}

function RequestWizard({ directions, intro, preset, linked }: Props & { preset: string; linked: boolean }) {
  const [step, setStep] = useState<1 | 2>(preset ? 2 : 1);
  const [direction, setDirection] = useState(preset);
  const [state, setState] = useState<State>({ status: "idle" });
  const modal = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const comment = useRef<HTMLDetailsElement>(null);
  const sending = useRef(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const pending = state.status === "sending";
  const sent = state.status === "sent";
  const selected = directions.find(item => item.code === direction);
  const errors = state.status === "error" ? state.errors ?? {} : {};

  function open(code = "") {
    if (sending.current) return;
    const preset = directions.find(item => item.code === code);
    if (preset) setDirection(preset.code);
    setStep(preset ? 2 : 1);
    setState({ status: "idle" });
    if (!modal.current?.open) modal.current?.showModal();
    title.current?.focus();
  }

  const openFromLocation = useEffectEvent(() => {
    if (window.location.hash === "#request") open(preset);
  });
  const openFromEvent = useEffectEvent((event: Event) => open((event as CustomEvent<string>).detail));
  useEffect(() => {
    if ((linked || window.location.hash === "#request") && !modal.current?.open) {
      modal.current?.showModal();
      title.current?.focus();
    }
    const followHash = () => openFromLocation();
    const followDirection = (event: Event) => openFromEvent(event);
    window.addEventListener("hashchange", followHash);
    window.addEventListener(DIRECTION_EVENT, followDirection);
    return () => {
      window.removeEventListener("hashchange", followHash);
      window.removeEventListener(DIRECTION_EVENT, followDirection);
    };
  }, [linked]);

  useEffect(() => {
    if (!modal.current?.open) return;
    if (state.status === "error") {
      if (state.errors?.comment && comment.current) comment.current.open = true;
      const invalid = modal.current.querySelector<HTMLElement>('[aria-invalid="true"]');
      (invalid || title.current)?.focus();
    } else if (!pending) {
      title.current?.focus();
    }
  }, [step, state, pending]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || !selected || step !== 2) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      direction,
      comment: String(data.get("comment") ?? "") || null,
    };
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.body !== fingerprint) attempt.current = { body: fingerprint, key: newIdempotencyKey() };
    sending.current = true;
    setState({ status: "sending" });
    try {
      const { response, error } = await createServiceRequest(attempt.current.key, body);
      if (response.ok) {
        attempt.current = null;
        form.reset();
        if (comment.current) comment.current.open = false;
        setDirection("");
        setState({ status: "sent" });
      } else {
        const problem = (error ?? {}) as Problem;
        if (problem.code === "idempotency.key_mismatch") attempt.current = null;
        if (problem.errors?.direction) setStep(1);
        setState({ status: "error", message: problem.title ?? "Не вдалося надіслати заявку. Спробуйте ще раз.", errors: problem.errors });
      }
    } catch {
      setState({ status: "error", message: "Немає зв’язку з сервером. Спробуйте ще раз." });
    } finally {
      sending.current = false;
    }
  }

  return <>
    <div className="request-launch">
      {intro}
      <button ref={trigger} type="button" className="btn btn--graphite" aria-haspopup="dialog" onClick={() => open()}>Обрати послугу</button>
    </div>
    <dialog ref={modal} className="request-dialog" aria-labelledby="request-title"
      onCancel={event => { if (sending.current) event.preventDefault(); }}
      onClose={() => trigger.current?.focus({ preventScroll: true })}>
      <header className="request-dialog__head">
        <div>
          {!sent && <small>Крок {step} із 2</small>}
          <h2 id="request-title" ref={title} tabIndex={-1}>{sent ? "Заявку надіслано" : step === 1 ? "Оберіть послугу" : "Ваші контакти"}</h2>
        </div>
        <button className="icon-btn" type="button" aria-label="Закрити" disabled={pending} onClick={() => modal.current?.close()}><CloseIcon /></button>
      </header>
      {sent ? <div className="request-dialog__body">
        <p>Менеджер зателефонує в робочий час, щоб узгодити деталі.</p>
        <button className="btn" onClick={() => modal.current?.close()}>Готово</button>
      </div> : <>
        {step === 1 && <div className="request-dialog__body">
          <fieldset className="request-choices">
            <legend className="visually-hidden">Послуга для саду</legend>
            {directions.map(item => <label key={item.code}>
              <input type="radio" name="service-choice" checked={direction === item.code}
                onChange={() => setDirection(item.code)} aria-label={item.name} />
              <span>{item.name}</span>
              {direction === item.code && item.description && <small>{item.description}</small>}
            </label>)}
          </fieldset>
          {errors.direction && <p className="field__error" role="alert">{errors.direction[0]}</p>}
          <button className="btn" disabled={!selected} onClick={() => { setState({ status: "idle" }); setStep(2); }}>Далі</button>
        </div>}
        <form className="request-dialog__body" hidden={step !== 2} onSubmit={submit}>
          <div className="request-selected"><strong>{selected?.name}</strong>
            <button className="btn btn--quiet btn--small" type="button" disabled={pending} onClick={() => { setState({ status: "idle" }); setStep(1); }}>Змінити</button>
          </div>
          <div className="field"><label htmlFor="request-name">Ім’я</label>
            <input id="request-name" name="name" required readOnly={pending} autoComplete="name" maxLength={100}
              aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "request-name-error" : undefined} />
            {errors.name && <p id="request-name-error" className="field__error">{errors.name[0]}</p>}
          </div>
          <div className="field"><label htmlFor="request-phone">Телефон</label>
            <input id="request-phone" name="phone" type="tel" required readOnly={pending} autoComplete="tel" placeholder="+380 67 123 45 67"
              aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "request-phone-error" : undefined} />
            {errors.phone && <p id="request-phone-error" className="field__error">{errors.phone[0]}</p>}
          </div>
          <details ref={comment} className="request-comment"><summary>Додати коментар</summary>
            <div className="field"><textarea name="comment" aria-label="Коментар" readOnly={pending} maxLength={1000}
              aria-invalid={Boolean(errors.comment)} aria-describedby={errors.comment ? "request-comment-error" : undefined} /></div>
            {errors.comment && <p id="request-comment-error" className="field__error">{errors.comment[0]}</p>}
          </details>
          {state.status === "error" && <p role="alert" className="field__error">{state.message}</p>}
          <button type="submit" className="btn" disabled={pending} aria-busy={pending}>{pending ? "Надсилаємо…" : "Надіслати заявку"}</button>
        </form>
      </>}
    </dialog>
  </>;
}
