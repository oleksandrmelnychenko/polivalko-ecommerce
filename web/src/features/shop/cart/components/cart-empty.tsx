import Link from "next/link";

export function CartEmpty() {
  return (
    <div className="empty">
      <h2>У кошику поки нічого</h2>
      <p>Додайте товари з каталогу, і вони з&apos;являться тут.</p>
      <Link href="/catalog" className="btn">
        Обрати товари
      </Link>
    </div>
  );
}
