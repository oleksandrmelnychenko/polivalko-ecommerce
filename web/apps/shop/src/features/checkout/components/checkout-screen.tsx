import Link from "next/link";
import { CheckoutForm } from "./checkout-form";

export function CheckoutScreen() {
  return (
    <div className="container">
      <header className="page-head">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li>
              <Link href="/catalog">Каталог</Link>
            </li>
            <li aria-current="page">Оформлення</li>
          </ol>
        </nav>
        <h1>Оформлення замовлення</h1>
      </header>
      <CheckoutForm />
    </div>
  );
}
