import Link from "next/link";

export function CheckoutEmpty() {
  return (
    <div className="empty">
      <h2>У кошику поки нічого</h2>
      <p>Оберіть товари в каталозі, а потім поверніться сюди.</p>
      <Link href="/catalog" className="btn">
        Обрати товари
      </Link>
    </div>
  );
}
