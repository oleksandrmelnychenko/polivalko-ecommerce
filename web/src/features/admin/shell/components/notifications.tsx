"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { formatMoney } from "@/shared/lib/format";
import { BellIcon } from "@/shared/ui/icons";
import { getNewOrders } from "../api/client";
import type { Summary } from "../lib/nav";

export function Notifications({ summary }: { summary?: Summary }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const latest = useAdminData(`bell|${open}`, () =>
    open ? getNewOrders() : Promise.resolve({ data: undefined, response: new Response(null, { status: 204 }) }),
  );

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const rows = summary
    ? [
        { n: summary.newOrders, label: "нових замовлень", href: "/admin/orders?status=new", tone: "is-hot" },
        { n: summary.awaitingConfirmation, label: "чекають підтвердження", href: "/admin/orders?status=awaitingConfirmation", tone: "is-hot" },
        { n: summary.awaitingPayment, label: "чекають оплати", href: "/admin/orders?status=awaitingPayment", tone: "" },
        { n: summary.newServiceRequests, label: "нових заявок на послуги", href: "/admin/requests?status=new", tone: "is-hot" },
        { n: summary.pendingRefunds, label: "повернень в обробці", href: "/admin/orders", tone: "" },
        { n: summary.failedOperations, label: "невиконаних фонових операцій", href: "/admin/integration", tone: "is-bad" },
      ].filter((r) => r.n > 0)
    : [];
  const total = summary ? summary.newOrders + summary.awaitingConfirmation + summary.newServiceRequests + summary.failedOperations : 0;

  return (
    <div className="notify" ref={box}>
      <button
        type="button"
        className="admin-top__icon"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={total ? `Сповіщення: ${total}` : "Сповіщення"}
        onClick={() => setOpen((o) => !o)}
      >
        <BellIcon />
        {total > 0 && <span className="admin-top__dot">{total > 99 ? "99+" : total}</span>}
      </button>
      {open && (
        <div className="notify__panel" role="region" aria-label="Сповіщення">
          <p className="notify__head">
            Потребує уваги
            {summary && !summary.catalogDataFresh && <span className="chip chip--pink">Ціни застаріли</span>}
          </p>
          {rows.length === 0 ? (
            <p className="notify__empty">Усе оброблено. Нових подій немає.</p>
          ) : (
            <ul className="notify__list">
              {rows.map((r) => (
                <li key={r.label}>
                  <Link href={r.href} className={r.tone} onClick={() => setOpen(false)}>
                    <b>{r.n}</b>
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {latest.data && latest.data.items.length > 0 && (
            <>
              <p className="notify__head">Нові замовлення</p>
              <ul className="notify__list">
                {latest.data.items.map((o) => (
                  <li key={o.number}>
                    <Link href={`/admin/orders/${o.number}`} onClick={() => setOpen(false)}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="cell-strong">{o.number}</span>
                        <span className="cell-sub">{o.customerName}</span>
                      </span>
                      <span className="cell-strong">{formatMoney(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
