import { Suspense, type ReactNode } from "react";
import { CartDrawer, CartProvider } from "@/features/cart";
import { ShopTools } from "./shop-tools";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function ShopShell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      <main id="main">{children}</main>
      <Suspense fallback={null}><ShopTools /></Suspense>
      <SiteFooter />
      <CartDrawer />
    </CartProvider>
  );
}
