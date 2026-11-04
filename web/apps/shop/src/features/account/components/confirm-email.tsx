"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { refreshSession, withCsrf } from "@/features/customer";
import { fieldErrors } from "@polivalko/shared/api/problem";
import { postConfirmEmail } from "../api/client";

type State = { kind: "pending" } | { kind: "ok" } | { kind: "error"; text: string };

export function ConfirmEmail() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "pending" });
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!token || sent.current === token) return;
    sent.current = token;
    void withCsrf((h) => postConfirmEmail(h, token)).then(
      ({ response, error }) => {
        if (response.ok) {
          setState({ kind: "ok" });
          void refreshSession();
        } else {
          setState({ kind: "error", text: fieldErrors(error).token ?? "Не вдалося підтвердити email. Спробуйте ще раз." });
        }
      },
      () => setState({ kind: "error", text: "Немає зв'язку з сервером. Оновіть сторінку." }),
    );
  }, [token]);

  const current: State = token ? state : { kind: "error", text: "У посиланні немає коду. Відкрийте його з листа повністю." };

  return (
    <div className="auth__done" aria-live="polite">
      {current.kind === "pending" && <p className="notice">Підтверджуємо email…</p>}
      {current.kind === "ok" && (
        <p className="notice notice--ok">
          <strong>Email підтверджено</strong>
          Дякуємо! Листи про замовлення надходитимуть на цю адресу, а замовлення, оформлені з нею раніше, з&apos;являться в кабінеті.
        </p>
      )}
      {current.kind === "error" && (
        <p className="notice notice--error">
          <strong>Посилання не спрацювало</strong>
          {current.text} Увійдіть у кабінет і надішліть лист ще раз.
        </p>
      )}
      {current.kind !== "pending" && (
        <Link href="/account" className="btn">
          Перейти до кабінету
        </Link>
      )}
    </div>
  );
}
