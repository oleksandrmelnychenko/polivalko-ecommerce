"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ClipboardIcon } from "@polivalko/shared/ui/icons";
import { getOrders } from "../api/client";
import { useAccountData } from "../hooks/use-account-data";
import { AccountPager } from "./account-pager";
import { OrderRow } from "./order-row";
import { RowsSkeleton } from "./rows-skeleton";
import { StateBox } from "./state-box";

function ordersHref(page: number) {
  return page === 1 ? "/account/orders" : `/account/orders?page=${page}`;
}

export function OrdersList() {
  const router = useRouter();
  const rawPage = useSearchParams().get("page");
  const requested = Number(rawPage);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, 100_000) : 1;
  const { data, loading, failed, reload } = useAccountData(`orders-${page}`, () => getOrders(page));
  const target = data ? Math.min(page, Math.max(1, data.totalPages)) : page;
  const replacePage = rawPage !== null && rawPage !== String(target);
  useEffect(() => {
    if (replacePage) router.replace(ordersHref(target), { scroll: false });
  }, [replacePage, router, target]);

  if (loading || replacePage) return <RowsSkeleton />;
  if (failed || !data)
    return (
      <StateBox
        title="Не вдалося завантажити замовлення"
        text="Перевірте зв'язок і спробуйте ще раз."
        action={
          <button type="button" className="btn" onClick={reload}>
            Спробувати ще раз
          </button>
        }
      />
    );
  if (data.totalItems === 0)
    return <StateBox icon={<ClipboardIcon />} title="Замовлень ще немає" text="Після першої покупки тут можна буде перевірити статус замовлення та переглянути чек." action={{ href: "/catalog", label: "Перейти до каталогу" }} />;

  return (
    <>
      <table className="order-rows" aria-label="Мої замовлення">
        <thead><tr><th scope="col">Замовлення</th><th scope="col">Статус</th><th scope="col">Оплата</th><th scope="col">Сума</th></tr></thead>
        <tbody>{data.items.map((order) => <OrderRow key={order.number} order={order} />)}</tbody>
      </table>
      <AccountPager page={data.page} totalPages={data.totalPages} href={ordersHref} />
    </>
  );
}
