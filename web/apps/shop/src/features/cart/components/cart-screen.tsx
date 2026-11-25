import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { CartView } from "./cart-view";

export function CartScreen() {
  return (
    <div className="container cart-page">
      <Breadcrumbs current="Кошик" />
      <header className="page-head">
        <h1>Кошик</h1>
      </header>
      <CartView />
    </div>
  );
}
