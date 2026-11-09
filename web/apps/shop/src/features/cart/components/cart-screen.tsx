import Link from "next/link";
import { CartView } from "./cart-view";

export function CartScreen() {
  return (
    <div className="container">
      <header className="page-head">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li>
              <Link href="/">Головна</Link>
            </li>
            <li aria-current="page">Кошик</li>
          </ol>
        </nav>
        <h1>Кошик</h1>
      </header>
      <CartView />
    </div>
  );
}
