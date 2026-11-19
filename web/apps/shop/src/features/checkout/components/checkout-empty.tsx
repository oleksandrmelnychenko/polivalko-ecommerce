import Link from "next/link";

export function CheckoutEmpty() {
  return (
    <div className="empty">
      <h2>Кошик порожній</h2>
      <p>Додайте товари з каталогу, щоб оформити замовлення.</p>
      <Link href="/catalog" className="btn">
        Обрати товари
      </Link>
    </div>
  );
}
