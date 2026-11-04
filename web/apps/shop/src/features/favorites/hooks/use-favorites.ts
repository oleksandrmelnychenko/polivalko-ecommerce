"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useCustomer } from "@/features/customer";
import { getFavorites, getServerFavorites, loadFavorites, resetFavorites, subscribeFavorites } from "../lib/favorites-store";

const NONE: ReadonlySet<string> = new Set();

export function useFavorites() {
  const customer = useCustomer();
  const favorites = useSyncExternalStore(subscribeFavorites, getFavorites, getServerFavorites);
  const owner = customer.me?.id ?? null;

  useEffect(() => {
    if (owner) loadFavorites(owner);
    else if (customer.status === "guest") resetFavorites();
  }, [owner, customer.status]);

  const ready = owner !== null && favorites.owner === owner;
  return { status: customer.status, ready, ids: ready ? favorites.ids : NONE };
}
