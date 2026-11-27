"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isAnalyticsAllowedLocation, isPrivateAnalyticsPath } from "../lib/privacy";

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] };
  }
}

const SCRIPT_ID = "pv-clarity-script";
const CONFIGURED_ID = (process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "").trim();

function ensureClarity(projectId: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (!isAnalyticsAllowedLocation(window.location)) return false;

  if (typeof window.clarity !== "function") {
    const queueFn = function clarity(...args: unknown[]) {
      queueFn.q = queueFn.q ?? [];
      queueFn.q.push(args);
    } as ((...args: unknown[]) => void) & { q?: unknown[][] };
    queueFn.q = [];
    window.clarity = queueFn;
  }

  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
    document.head.appendChild(script);
  }
  return true;
}

/**
 * Loads Microsoft Clarity heatmaps/session recordings strictly on public production routes.
 * Dormant until NEXT_PUBLIC_CLARITY_PROJECT_ID is configured; never loads on /order/*, /account/*, /pay/*,
 * token-bearing URLs, or local/preview hosts.
 */
export function MicrosoftClarity({ projectId = CONFIGURED_ID }: { projectId?: string } = {}) {
  const pathname = usePathname();
  const id = projectId.trim();
  const allowed = Boolean(id) && !isPrivateAnalyticsPath(pathname);

  useEffect(() => {
    if (!allowed) return;
    ensureClarity(id);
  }, [allowed, id, pathname]);

  return null;
}
