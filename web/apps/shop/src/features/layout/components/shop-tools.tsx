"use client";

import { usePathname } from "next/navigation";
import { AssistantWidget } from "@/features/assistant";
import { BackToTop } from "./back-to-top";

export function ShopTools() {
  const pathname = usePathname();
  const inlineOnMobile = pathname === "/cart" || pathname === "/checkout";

  return (
    <div className={inlineOnMobile ? "shop-tools shop-tools--purchase" : "shop-tools"}>
      <BackToTop />
      <AssistantWidget />
    </div>
  );
}
