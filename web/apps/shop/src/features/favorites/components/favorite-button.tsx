"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { currentPath, loadSession, loginHref } from "@/features/customer";
import { useFavorites } from "../hooks/use-favorites";
import { toggleFavorite } from "../lib/favorites-store";
import { HeartIcon } from "./heart-icon";

const FAILED = "Не вдалося оновити обране. Спробуйте ще раз.";

export function FavoriteButton({ productId, name, variant = "round" }: { productId: string; name?: string; variant?: "round" | "box" }) {
  const router = useRouter();
  const { status, owner, ids } = useFavorites();
  const [failed, setFailed] = useState(false);
  const on = ids.has(productId);
  const label = failed ? FAILED : on ? "Прибрати з обраного" : "Додати в обране";

  async function click() {
    setFailed(false);
    const session = status === "unknown" ? await loadSession() : null;
    const current = session?.status ?? status;
    const id = session ? (session.me?.id ?? null) : owner;
    if (current === "guest") {
      router.push(loginHref(currentPath(), "favorites"));
      return;
    }
    if (current !== "signedIn" || !id || !(await toggleFavorite(productId, id))) setFailed(true);
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
      {failed && (
        <span className="visually-hidden" role="status">
          {FAILED}
        </span>
      )}
    </button>
  );
}
