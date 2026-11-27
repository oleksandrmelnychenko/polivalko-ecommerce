"use client";

import { useSyncExternalStore } from "react";
import { reportShopActivity } from "@/shared/api/shop-activity";
import { showProductNotice } from "@/shared/ui/product-notice";
import { loadSession } from "@/features/customer";
import { useFavorites } from "../hooks/use-favorites";
import { toggleFavorite } from "../lib/favorites-store";
import { isGuestFavorite, subscribeGuestFavorites, toggleGuestFavorite } from "../lib/guest-favorites";
import { HeartIcon } from "./heart-icon";

const FAILED = "Не вдалося оновити обране. Спробуйте ще раз.";

export function FavoriteButton({ productId, name, variant = "round" }: { productId: string; name: string; variant?: "round" | "box" }) {
  const { status, owner, ids } = useFavorites();
  const guestOn = useSyncExternalStore(subscribeGuestFavorites, () => isGuestFavorite(productId), () => false);
  const on = status === "guest" ? guestOn : ids.has(productId);
  const label = on ? "Прибрати з обраного" : "Додати в обране";

  async function click() {
    const session = status === "unknown" ? await loadSession() : null;
    const current = session?.status ?? status;
    const id = session ? (session.me?.id ?? null) : owner;
    let result: Awaited<ReturnType<typeof toggleFavorite>> = "error";
    if (current === "guest") {
      if (toggleGuestFavorite(productId)) result = isGuestFavorite(productId) ? "added" : "removed";
    } else if (current === "signedIn" && id) {
      result = await toggleFavorite(productId, id);
    }
    if (result === "busy") return;
    if (result === "added") reportShopActivity("favorite_add", productId);
    else if (result === "removed") reportShopActivity("favorite_remove", productId);
    showProductNotice({
      kind: result,
      title: result === "added" ? "Додано до обраного" : result === "removed" ? "Прибрано з обраного" : FAILED,
      message: name,
      action: result !== "error"
        ? { href: current === "signedIn" ? "/account/favorites" : "/favorites", label: "Переглянути обране" }
        : undefined,
    });
  }

  return (
    <button
      type="button"
      className={variant === "box" ? "fav-toggle fav-toggle--box" : "round-btn fav-toggle"}
      onClick={click}
      aria-pressed={on}
      aria-label={`${label}: ${name}`}
      title={label}
    >
      <HeartIcon />
    </button>
  );
}
