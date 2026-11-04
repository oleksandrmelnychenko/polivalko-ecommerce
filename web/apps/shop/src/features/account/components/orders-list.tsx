"use client";

import { useSearchParams } from "next/navigation";
import { getOrders } from "../api/client";
import { useAccountData } from "../hooks/use-account-data";
import { AccountPager } from "./account-pager";
import { OrderRow } from "./order-row";
import { RowsSkeleton } from "./rows-skeleton";
import { StateBox } from "./state-box";

export function OrdersList() {
  const page = Math.max(1, Math.floor(Number(useSearchParams().get("page"))) || 1);
  const { data, loading, failed, reload } = useAccountData(`orders-${page}`, () => getOrders(page));

  if (loading) return <RowsSkeleton />;
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
    return <StateBox title="Замовлень ще немає" text="Тут з'являтимуться ваші замовлення з номером, статусом і чеками." action={{ href: "/catalog", label: "Перейти до каталогу" }} />;

  return (
    <>
      <ul className="order-rows">
        {data.items.map((order) => (
          <OrderRow key={order.number} order={order} />
        ))}
      </ul>
      <AccountPager page={data.page} totalPages={data.totalPages} href={(n) => (n === 1 ? "/account/orders" : `/account/orders?page=${n}`)} />
    </>
  );
}
