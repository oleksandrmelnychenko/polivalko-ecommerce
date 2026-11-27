"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Quote } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { quoteCart } from "@/shared/api/quote-cart";
import { useCustomer } from "@/features/customer";
import { thumb } from "@/shared/lib/images";
import { hasPrice, PRICE_ON_REQUEST } from "@/shared/lib/price";
import { guestFavoriteKeys, subscribeGuestFavorites } from "../lib/guest-favorites";
import { FavoriteButton } from "./favorite-button";

export function GuestFavoritesScreen() {
  const keys = useSyncExternalStore(subscribeGuestFavorites, guestFavoriteKeys, () => "");
  const { status } = useCustomer();
  const router = useRouter();
  const [result, setResult] = useState<{ key: string; rows: Quote["items"] | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (status === "signedIn") router.replace("/account/favorites");
    if (status !== "guest" || !keys) return;
    const controller = new AbortController();
    async function load() {
      const ids = keys.split(",");
      const rows: Quote["items"] = [];
      for (let start = 0; start < ids.length; start += 50) {
        const { data } = await quoteCart(ids.slice(start, start + 50).map(productId => ({ productId, quantity: 1 })), controller.signal);
        if (!data) throw new Error("favorites");
        rows.push(...data.items);
      }
      return rows;
    }
    load().catch(() => null).then(rows => { if (!controller.signal.aborted) setResult({ key: keys, rows }); });
    return () => controller.abort();
  }, [keys, status, router, attempt]);
  if (status === "guest" && !keys) return <div className="empty"><h2>В обраному поки порожньо</h2><p>Натисніть сердечко біля товару, щоб зберегти його тут.</p><Link href="/catalog" className="btn btn--graphite">До каталогу</Link></div>;
  if (status !== "guest" || result?.key !== keys) return <p role="status">Завантажуємо обране…</p>;
  if (!result.rows) return <p role="status">Не вдалося завантажити обране. <button type="button" className="link" onClick={() => setAttempt(n => n + 1)}>Спробувати ще раз</button></p>;
  return (
    <ul className="guest-favorites">
      {result.rows.map(row => (
        <li key={row.productId}>
          <span className="guest-favorites__photo">
            {row.imageUrl
              ? <img src={thumb(row.imageUrl)} width="72" height="72" alt="" loading="lazy" />
              : <small>Фото відсутнє</small>}
          </span>
          <div className="guest-favorites__name">
            {row.slug ? <Link href={`/product/${row.slug}`}>{row.name}</Link> : row.name}
          </div>
          {row.slug && <span className="guest-favorites__price money">
            {hasPrice(row.unitPrice) ? formatMoney(row.unitPrice) : PRICE_ON_REQUEST}
          </span>}
          <FavoriteButton productId={row.productId} name={row.name} variant="box" />
        </li>
      ))}
    </ul>
  );
}
