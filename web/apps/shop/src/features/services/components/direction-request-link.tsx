"use client";

import type { MouseEvent } from "react";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { DIRECTION_EVENT } from "../lib/direction-event";

export function DirectionRequestLink({ code }: { code: string }) {
  const href = `/services?direction=${encodeURIComponent(code)}#request`;

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    window.dispatchEvent(new CustomEvent<string>(DIRECTION_EVENT, { detail: code }));
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("request")?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    window.setTimeout(() => document.getElementById("name")?.focus({ preventScroll: true }), smooth ? 600 : 0);
  }

  return (
    <a className="ib-card__link" href={href} onClick={onClick}>
      Залишити заявку
      <ArrowRightIcon />
    </a>
  );
}
