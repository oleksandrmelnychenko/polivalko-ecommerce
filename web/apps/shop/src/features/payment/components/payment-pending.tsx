"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function PaymentPending({ onRefresh }: { onRefresh?: () => void }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (attempt >= 10) return;
    const timer = setTimeout(() => {
      if (onRefresh) onRefresh();
      else router.refresh();
      setAttempt((n) => n + 1);
    }, 2000);
    return () => clearTimeout(timer);
  }, [attempt, router, onRefresh]);

  return (
    <section className="pay" aria-live="polite">
      <h2>Перевіряємо оплату</h2>
      <p>
        {attempt < 10
          ? "Чекаємо підтвердження від платіжної системи. Це займає кілька секунд."
          : "Підтвердження ще не надійшло. Оновіть сторінку трохи пізніше: якщо гроші списано, статус зміниться автоматично."}
      </p>
    </section>
  );
}
