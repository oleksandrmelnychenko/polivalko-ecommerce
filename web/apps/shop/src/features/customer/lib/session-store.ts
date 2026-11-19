import { getMe } from "../api/client";
import type { CustomerMe, Session } from "./types";

export const SESSION_SIGNAL = "pv-customer";
const UNKNOWN: Session = { status: "unknown", me: null };
const UNVERIFIED: Session = { status: "unknown", me: null, failed: true };
const GUEST: Session = { status: "guest", me: null };
const RETRY_FIRST = 3000;
const RETRY_MAX = 30000;

let session: Session = UNKNOWN;
let pending: Promise<Session> | null = null;
let generation = 0;
let retryDelay = RETRY_FIRST;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function signalSessionChange() {
  try {
    window.localStorage.setItem(SESSION_SIGNAL, crypto.randomUUID());
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
  if (session.me?.id !== me.id) signalSessionChange();
  generation += 1;
  pending = null;
  stopRetry();
  set({ status: "signedIn", me });
}

export function setSignedOut() {
  signalSessionChange();
  generation += 1;
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

async function fetchSession(current: number): Promise<Session> {
  try {
    const { data, response } = await getMe();
    if (current !== generation) return session;
    if (data) {
      if (session.me?.id !== data.id) generation += 1;
      pending = null;
      stopRetry();
      set({ status: "signedIn", me: data });
    } else if (response.status === 401) {
      if (session.status !== "guest") generation += 1;
      pending = null;
      stopRetry();
      set(GUEST);
    } else {
      checkFailed();
    }
  } catch {
    if (current === generation) checkFailed();
  }
  return session;
}

export function loadSession(): Promise<Session> {
  if (session.status !== "unknown") return Promise.resolve(session);
  return refreshSession();
}

export function refreshSession(): Promise<Session> {
  pending ??= fetchSession(generation);
  return pending;
}

export function refreshChangedSession(): Promise<Session> {
  generation += 1;
  pending = null;
  set(UNKNOWN);
  return refreshSession();
}

export async function withActiveSession<R extends { response: Response }>(send: (assertActive: () => void) => Promise<R>): Promise<R> {
  const current = generation;
  function assertActive() {
    if (current !== generation) throw new Error("Сеанс змінився. Спробуйте ще раз.");
  }
  const result = await send(assertActive);
  assertActive();
  if (result.response.status === 401 && session.status !== "guest") setSignedOut();
  return result;
}
