import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { Suspense } from "react";
import type { PickupPoint } from "@polivalko/shared/api/types";
import { CheckoutForm } from "./checkout-form";

type CheckoutScreenProps = { mailDelivers: () => Promise<boolean>; storePhone: () => Promise<string | null>; pickupPoints: () => Promise<PickupPoint[]> };

export function CheckoutScreen(props: CheckoutScreenProps) {
  return (
    <div className="container checkout-page">
      <Breadcrumbs current="Оформлення замовлення" parents={[{ name: "Кошик", path: "/cart" }]} />
      <header className="page-head">
        <h1>Оформлення замовлення</h1>
      </header>
      <Suspense fallback={<p role="status">Завантажуємо кошик…</p>}>
        <CheckoutContent {...props} />
      </Suspense>
    </div>
  );
}

async function CheckoutContent({ mailDelivers, storePhone, pickupPoints }: CheckoutScreenProps) {
  // These loaders establish the request boundary before cached directory reads.
  const [mail, phone] = await Promise.all([mailDelivers(), storePhone()]);
  const points = await pickupPoints().catch(() => []);
  return <CheckoutForm mailDelivers={mail} phone={phone} pickupPoint={points[0] ?? null} />;
}
