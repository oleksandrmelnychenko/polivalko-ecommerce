"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const ATTEMPTS = 10;

export function PaymentPending({ onRefresh, children }: { onRefresh?: () => void; children?: ReactNode }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (attempt >= ATTEMPTS) return;
    const timer = setTimeout(() => {
      if (onRefresh) onRefresh();
      else router.refresh();
      setAttempt((n) => n + 1);
    }, 2000);
    return () => clearTimeout(timer);
  }, [attempt, router, onRefresh]);

  if (attempt < ATTEMPTS)
    return (
      <section className="pay" aria-live="polite">
        <h2>Перевіряємо оплату</h2>
        <p>Чекаємо підтвердження від платіжної системи. Це займає кілька секунд.</p>
      </section>
    );

  return (
    <>
      <p className="notice" role="status">
        <strong>Оплату ще не підтверджено</strong>
        Якщо гроші списано, оновіть сторінку трохи пізніше: статус зміниться. Якщо оплату не завершено, спробуйте ще раз.
      </p>
      {children}
    </>
  );
}
