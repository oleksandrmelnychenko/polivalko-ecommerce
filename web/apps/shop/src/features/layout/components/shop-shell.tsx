import type { ReactNode } from "react";
import { CartDrawer, CartProvider } from "@/features/cart";
import { BackToTop } from "./back-to-top";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function ShopShell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <CartDrawer />
      <BackToTop />
    </CartProvider>
  );
}
