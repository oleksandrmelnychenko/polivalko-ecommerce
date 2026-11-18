import { getMe } from "../api/client";
import type { CustomerMe, Session } from "./types";

const HINT_KEY = "pv-customer";
const UNKNOWN: Session = { status: "unknown", me: null };
const UNVERIFIED: Session = { status: "unknown", me: null, failed: true };
const GUEST: Session = { status: "guest", me: null };
const RETRY_FIRST = 3000;
const RETRY_MAX = 30000;

let session: Session = UNKNOWN;
let pending: Promise<Session> | null = null;
let retryDelay = RETRY_FIRST;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

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

function stopRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  retryDelay = RETRY_FIRST;
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
  stopRetry();
  set({ status: "signedIn", me });
}

export function setSignedOut() {
  writeHint(false);
  pending = null;
  stopRetry();
  set(GUEST);
}

function checkFailed() {
  pending = null;
  if (session.status !== "unknown") return;
  if (!session.failed) set(UNVERIFIED);
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (session.status === "unknown") void refreshSession();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX);
}

async function fetchSession(): Promise<Session> {
  try {
    const { data, response } = await getMe();
    if (data) setSignedIn(data);
    else if (response.status === 401) setSignedOut();
    else checkFailed();
  } catch {
    checkFailed();
  }
  return session;
}

export function loadSession(): Promise<Session> {
  if (session.status !== "unknown") return Promise.resolve(session);
  pending ??= fetchSession();
  return pending;
}

export function refreshSession(): Promise<Session> {
  pending = fetchSession();
  return pending;
}

export function expireOn401<R extends { response: Response }>(result: R): R {
  if (result.response.status === 401 && session.status !== "guest") setSignedOut();
  return result;
}
