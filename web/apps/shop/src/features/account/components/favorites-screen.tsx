"use client";

import { ProductTiles, ProductTilesSkeleton } from "@/features/catalog";
import { getFavoriteProducts, useFavorites } from "@/features/favorites";
import { countProducts } from "@polivalko/shared/lib/format";
import { useAccountData } from "../hooks/use-account-data";
import { CabinetHead } from "./cabinet-head";
import { StateBox } from "./state-box";

export function FavoritesScreen() {
  const favorites = useFavorites();
  const { data, loading, failed, reload } = useAccountData("favorites", getFavoriteProducts);
  const items = (data ?? []).filter((p) => !favorites.ready || favorites.ids.has(p.id));

  return (
    <section aria-labelledby="cabinet-title">
      <CabinetHead title="Обране">{items.length > 0 && <p className="muted">{countProducts(items.length)}</p>}</CabinetHead>
      {loading ? (
        <ProductTilesSkeleton count={3} columns={3} />
      ) : failed ? (
        <StateBox
          title="Не вдалося завантажити обране"
          text="Перевірте зв'язок і спробуйте ще раз."
          action={
            <button type="button" className="btn" onClick={reload}>
              Спробувати ще раз
            </button>
          }
        />
      ) : items.length > 0 ? (
        <ProductTiles products={items} columns={3} />
      ) : (
        <StateBox
          title="В обраному поки порожньо"
          text="Натисніть на сердечко біля товару, і він збережеться тут."
          action={{ href: "/catalog", label: "Перейти до каталогу" }}
        />
      )}
    </section>
  );
}
