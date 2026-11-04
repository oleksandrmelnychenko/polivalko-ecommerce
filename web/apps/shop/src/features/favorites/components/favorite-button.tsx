"use client";

import { useRouter } from "next/navigation";
import { currentPath, loadSession, loginHref } from "@/features/customer";
import { useFavorites } from "../hooks/use-favorites";
import { toggleFavorite } from "../lib/favorites-store";
import { HeartIcon } from "./heart-icon";

export function FavoriteButton({ productId, name, variant = "round" }: { productId: string; name?: string; variant?: "round" | "box" }) {
  const router = useRouter();
  const { status, ids } = useFavorites();
  const on = ids.has(productId);
  const label = on ? "Прибрати з обраного" : "Додати в обране";

  async function click() {
    const session = status === "unknown" ? (await loadSession()).status : status;
    if (session !== "signedIn") {
      router.push(loginHref(currentPath(), "favorites"));
      return;
    }
    await toggleFavorite(productId);
  }

  return (
    <button
      type="button"
      className={variant === "box" ? "fav-toggle fav-toggle--box" : "round-btn fav-toggle"}
      onClick={click}
      aria-pressed={on}
      aria-label={name ? `${label}: ${name}` : label}
      title={label}
    >
      <HeartIcon />
    </button>
  );
}
