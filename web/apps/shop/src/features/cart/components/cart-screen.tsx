import { CartView } from "./cart-view";

export function CartScreen() {
  return (
    <div className="container cart-page">
      <header className="page-head">
        <h1>Кошик</h1>
      </header>
      <CartView />
    </div>
  );
}
