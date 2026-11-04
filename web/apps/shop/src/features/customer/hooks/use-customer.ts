"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getServerSession, getSession, loadSession, subscribeSession } from "../lib/session-store";

export function useCustomer() {
  const session = useSyncExternalStore(subscribeSession, getSession, getServerSession);
  useEffect(() => {
    void loadSession();
  }, []);
  return session;
}
