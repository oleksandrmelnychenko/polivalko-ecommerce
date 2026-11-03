"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon } from "@/shared/ui/icons";

export function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      className={shown ? "back-to-top is-shown" : "back-to-top"}
      aria-label="Повернутися вгору"
      tabIndex={shown ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
    >
      <ArrowUpIcon />
    </button>
  );
}
