import Link from "next/link";
import { Suspense } from "react";
import { CartButton } from "@/features/cart";
import { AccountButton } from "@/features/customer";
import { SearchButton } from "@/features/search";
import { MenuIcon } from "@polivalko/shared/ui/icons";
import { AnnouncementBar } from "./announcement-bar";
import { HeaderMobileMenu } from "./header-mobile-menu";
import { HeaderNav } from "./header-nav";
import { NavFallback } from "./nav-fallback";
import { HeaderMascot } from "./header-mascot";

export function SiteHeader() {
  return (
    <>
      <Suspense fallback={null}>
        <AnnouncementBar />
      </Suspense>
      <header className="site-header">
        <div className="container site-header__bar">
          <Link href="/" className="brand-logo site-header__brand" aria-label="Poli-Valko — на головну" translate="no">
            <HeaderMascot />
            <span className="brand-logo__wordmark">
              <span className="brand-logo__name">Poli-Valko</span>
              <span className="brand-logo__tagline">Дім · сад · город</span>
            </span>
          </Link>
          <Suspense fallback={<NavFallback />}>
            <HeaderNav />
          </Suspense>
          <div className="site-header__actions">
            <SearchButton />
            <AccountButton />
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
