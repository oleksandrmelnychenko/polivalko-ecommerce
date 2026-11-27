"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useFavorites } from "../hooks/use-favorites";
import { guestFavoriteKeys, subscribeGuestFavorites } from "../lib/guest-favorites";
import { HeartIcon } from "./heart-icon";

export function FavoritesLink() {
  const { status, ids } = useFavorites();
  const keys = useSyncExternalStore(subscribeGuestFavorites, guestFavoriteKeys, () => "");
  const count = status === "signedIn" ? ids.size : status === "guest" && keys ? keys.split(",").length : 0;
  return <Link className="icon-btn icon-btn--chrome favorites-link" href={status === "signedIn" ? "/account/favorites" : "/favorites"} prefetch={false}
    title="Переглянути обране" aria-label={`Обране: ${count}`}>
    <HeartIcon />{count > 0 && <span className="cart-button__count">{count}</span>}
  </Link>;
}
