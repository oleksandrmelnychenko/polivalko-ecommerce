const prefix = "polivalko.favorite.v1.";
const changeEvent = "polivalko:favorite";

export function isGuestFavorite(id: string) {
  try {
    return localStorage.getItem(prefix + id) === "1";
  } catch {
    return false;
  }
}

export function toggleGuestFavorite(id: string) {
  try {
    if (isGuestFavorite(id)) localStorage.removeItem(prefix + id);
    else localStorage.setItem(prefix + id, "1");
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(changeEvent));
  return true;
}

export function subscribeGuestFavorites(notify: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key.startsWith(prefix)) notify();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, notify);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, notify);
  };
}
