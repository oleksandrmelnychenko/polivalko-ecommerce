"use client";

import Link from "next/link";
import { useSyncExternalStore, type ComponentProps } from "react";

/**
 * next/link that starts prefetching only once the page has loaded and the browser is idle.
 * On a phone the header, dock and product tiles otherwise prefetch 15–18 route payloads (500–600 KB) during the
 * first second, sharing a slow connection with the hero photo; Lighthouse measured the home page LCP at 4.3–7.2 s.
 * After that the links prefetch as usual, so later navigations stay as fast as before.
 */
let idle = false;
let started = false;
const listeners = new Set<() => void>();

function start() {
  started = true;
  const done = () => {
    idle = true;
    listeners.forEach((listener) => listener());
  };
  const later = () => ("requestIdleCallback" in window ? requestIdleCallback(done, { timeout: 3000 }) : setTimeout(done, 1500));
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later, { once: true });
}

function subscribe(listener: () => void) {
  if (!started) start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export default function IdleLink({ prefetch, ...props }: ComponentProps<typeof Link>) {
  const ready = useSyncExternalStore(subscribe, () => idle, () => false);
  return <Link {...props} prefetch={ready ? prefetch : false} />;
}
