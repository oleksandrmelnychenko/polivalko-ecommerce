"use client";

import { useState } from "react";
import { withCsrf } from "@/features/customer";
import { postResendConfirmation } from "../api/client";

export function ConfirmBanner({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function resend() {
    setBusy(true);
    setMessage("");
    try {
      const { response } = await withCsrf((h) => postResendConfirmation(h));
      setMessage(
        response.ok
          ? `Лист надіслано на ${email}. Перевірте пошту, зокрема «Спам».`
          : response.status === 429
            ? "Забагато запитів. Спробуйте за кілька хвилин."
            : "Пошта зараз не працює. Спробуйте трохи пізніше.",
      );
    } catch {
      setMessage("Немає зв'язку з сервером. Спробуйте ще раз.");
    }
    setBusy(false);
  }

  return (
    <div className="notice cabinet-banner">
      <p>
        <strong>Підтвердьте email</strong>
        Ми надіслали лист на <b>{email}</b>. Перейдіть за посиланням у ньому, щоб отримувати листи про замовлення.
      </p>
      <button type="button" className="btn btn--quiet btn--small" onClick={resend} disabled={busy} aria-busy={busy}>
        Надіслати лист ще раз
      </button>
      <p className="cabinet-banner__status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
