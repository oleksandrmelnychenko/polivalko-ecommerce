import { withAccountCsrf, withActiveSession } from "@/features/customer";
import { deleteFavorite, getFavoriteIds, putFavorite } from "../api/client";

export type FavoritesState = { owner: string | null; ids: ReadonlySet<string> };

const EMPTY: FavoritesState = { owner: null, ids: new Set() };

let state: FavoritesState = EMPTY;
let loading: { owner: string; promise: Promise<boolean> } | null = null;
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

export function loadFavorites(owner: string): Promise<boolean> {
  if (state.owner === owner) return Promise.resolve(true);
  if (loading?.owner === owner) return loading.promise;
  const promise = withActiveSession(getFavoriteIds)
    .then(({ data }) => {
      if (loading?.owner !== owner) return false;
      loading = null;
      if (!data) return false;
      set({ owner, ids: new Set(data) });
      return true;
    })
    .catch(() => {
      if (loading?.owner === owner) loading = null;
      return false;
    });
  loading = { owner, promise };
  return promise;
}

export function resetFavorites() {
  loading = null;
  if (state.owner) set(EMPTY);
}

function withId(ids: ReadonlySet<string>, id: string, on: boolean) {
  const next = new Set(ids);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

export async function toggleFavorite(id: string, owner: string): Promise<boolean> {
  if (busy.has(id)) return true;
  busy.add(id);
  try {
    if (state.owner !== owner && !(await loadFavorites(owner))) return false;
    if (state.owner !== owner) return false;
    const on = !state.ids.has(id);
    set({ owner, ids: withId(state.ids, id, on) });
    let ok = false;
    try {
      const { response } = await withAccountCsrf((h) => (on ? putFavorite(h, id) : deleteFavorite(h, id)));
      ok = response.ok;
    } catch {}
    if (!ok && state.owner === owner) set({ owner, ids: withId(state.ids, id, !on) });
    return ok;
  } finally {
    busy.delete(id);
  }
}
