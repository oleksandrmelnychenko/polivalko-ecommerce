import Link from "next/link";
import { Suspense } from "react";
import { CartButton } from "@/features/cart";
import { SearchButton } from "@/features/search";
import { MenuIcon } from "@polivalko/shared/ui/icons";
import { HeaderMobileMenu } from "./header-mobile-menu";
import { HeaderNav } from "./header-nav";
import { NavFallback } from "./nav-fallback";

export function SiteHeader() {
  return (
    <>
      <header className="site-header">
        <div className="container site-header__bar">
          <Link href="/" className="logo" translate="no">
            PoliValko
          </Link>
          <Suspense fallback={<NavFallback />}>
            <HeaderNav />
          </Suspense>
          <div className="site-header__actions">
            <SearchButton />
            <CartButton />
            <button type="button" className="icon-btn icon-btn--chrome site-header__menu" popoverTarget="mobile-menu" aria-label="Меню й каталог">
              <MenuIcon />
            </button>
          </div>
        </div>
      </header>
      <Suspense fallback={null}>
        <HeaderMobileMenu />
      </Suspense>
    </>
  );
}
