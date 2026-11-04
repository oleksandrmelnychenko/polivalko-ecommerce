import { getMe } from "../api/client";
import type { CustomerMe, Session } from "./types";

const HINT_KEY = "pv-customer";
const UNKNOWN: Session = { status: "unknown", me: null };
const GUEST: Session = { status: "guest", me: null };

let session: Session = UNKNOWN;
let pending: Promise<Session> | null = null;
const listeners = new Set<() => void>();

function readHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHint(on: boolean) {
  try {
    if (on) window.localStorage.setItem(HINT_KEY, "1");
    else window.localStorage.removeItem(HINT_KEY);
  } catch {}
}

function set(next: Session) {
  session = next;
  listeners.forEach((l) => l());
}

export const getSession = () => session;
export const getServerSession = () => UNKNOWN;

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSignedIn(me: CustomerMe) {
  writeHint(true);
  pending = null;
  set({ status: "signedIn", me });
}

export function setSignedOut() {
  writeHint(false);
  pending = null;
  set(GUEST);
}

async function fetchSession(): Promise<Session> {
  try {
    const { data, response } = await getMe();
    if (data) setSignedIn(data);
    else if (response.status === 401) setSignedOut();
    else set(GUEST);
  } catch {
    set(GUEST);
  }
  return session;
}

export function loadSession(): Promise<Session> {
  if (session.status !== "unknown") return Promise.resolve(session);
  if (!readHint()) {
    set(GUEST);
    return Promise.resolve(session);
  }
  pending ??= fetchSession();
  return pending;
}

export function refreshSession(): Promise<Session> {
  if (!readHint()) return loadSession();
  pending = fetchSession();
  return pending;
}

export function expireOn401<R extends { response: Response }>(result: R): R {
  if (result.response.status === 401 && session.status !== "guest") setSignedOut();
  return result;
}
