import Link from "next/link";
import { BagIcon } from "@polivalko/shared/ui/icons";

export function CartEmpty({ onNavigate, drawer = false }: { onNavigate?: () => void; drawer?: boolean } = {}) {
  return (
    <div className={drawer ? "cart-empty" : "cart-empty cart-empty--page"}>
      <span className="cart-empty__icon"><BagIcon /></span>
      <h2>Кошик порожній</h2>
      <p>Додайте товари з каталогу, щоб оформити замовлення.</p>
      <Link href="/catalog" className="btn" onClick={onNavigate}>
        Перейти до каталогу
      </Link>
      <div className="cart-empty__suggestions"><span>Категорії товарів</span><Link href="/catalog/vse-dlia-polyvu" onClick={onNavigate}>Усе для поливу <span aria-hidden="true">↗</span></Link><Link href="/catalog/vse-dlia-roslyn" onClick={onNavigate}>Усе для рослин <span aria-hidden="true">↗</span></Link><Link href="/catalog/ruchnyi-instrument" onClick={onNavigate}>Садові інструменти <span aria-hidden="true">↗</span></Link></div>
    </div>
  );
}
