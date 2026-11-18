import Link from "next/link";
import { Suspense } from "react";
import { CheckoutForm } from "./checkout-form";

type CheckoutScreenProps = { mailDelivers: () => Promise<boolean>; storePhone: () => Promise<string | null> };

export function CheckoutScreen(props: CheckoutScreenProps) {
  return (
    <div className="container">
      <header className="page-head">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li>
              <Link href="/">Головна</Link>
            </li>
            <li>
              <Link href="/cart">Кошик</Link>
            </li>
            <li aria-current="page">Оформлення</li>
          </ol>
        </nav>
        <h1>Оформлення замовлення</h1>
      </header>
      <Suspense fallback={<p role="status">Завантажуємо кошик…</p>}>
        <CheckoutContent {...props} />
      </Suspense>
    </div>
  );
}

async function CheckoutContent({ mailDelivers, storePhone }: CheckoutScreenProps) {
  const [mail, phone] = await Promise.all([mailDelivers(), storePhone()]);
  return <CheckoutForm mailDelivers={mail} phone={phone} />;
}
