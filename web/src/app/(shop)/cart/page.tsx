import type { Metadata } from "next";
import Link from "next/link";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Кошик", robots: { index: false, follow: false } };

export default function CartPage() {
  return (
    <div className="container">
      <header className="page-head">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li>
              <Link href="/catalog">Каталог</Link>
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
