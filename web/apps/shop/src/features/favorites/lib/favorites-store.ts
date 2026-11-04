import { expireOn401, withCsrf } from "@/features/customer";
import { deleteFavorite, getFavoriteIds, putFavorite } from "../api/client";

export type FavoritesState = { owner: string | null; ids: ReadonlySet<string> };

const EMPTY: FavoritesState = { owner: null, ids: new Set() };

let state: FavoritesState = EMPTY;
let loadingFor: string | null = null;
const busy = new Set<string>();
const listeners = new Set<() => void>();

function set(next: FavoritesState) {
  state = next;
  listeners.forEach((l) => l());
}

export const getFavorites = () => state;
export const getServerFavorites = () => EMPTY;

export function subscribeFavorites(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadFavorites(owner: string) {
  if (state.owner === owner || loadingFor === owner) return;
  loadingFor = owner;
  void getFavoriteIds()
    .then(expireOn401)
    .then(({ data }) => {
      if (loadingFor !== owner) return;
      loadingFor = null;
      if (data) set({ owner, ids: new Set(data) });
    })
    .catch(() => {
      if (loadingFor === owner) loadingFor = null;
    });
}

export function resetFavorites() {
  loadingFor = null;
  if (state.owner) set(EMPTY);
}

function withId(ids: ReadonlySet<string>, id: string, on: boolean) {
  const next = new Set(ids);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

export async function toggleFavorite(id: string): Promise<boolean> {
  if (busy.has(id) || !state.owner) return false;
  const owner = state.owner;
  const on = !state.ids.has(id);
  busy.add(id);
  set({ owner, ids: withId(state.ids, id, on) });
  let ok = false;
  try {
    const { response } = expireOn401(await withCsrf((h) => (on ? putFavorite(h, id) : deleteFavorite(h, id))));
    ok = response.ok;
  } catch {}
  busy.delete(id);
  if (!ok && state.owner === owner) set({ owner, ids: withId(state.ids, id, !on) });
  return ok;
}
