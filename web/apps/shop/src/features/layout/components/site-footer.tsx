import Link from "@/shared/ui/idle-link";
import { purchasePages, privacyPage } from "@/shared/lib/customer-pages";
import { JOURNAL_ENABLED } from "@/features/journal";
import { Suspense } from "react";
import { FooterColumn } from "./footer-column";
import { FooterContacts } from "./footer-contacts";
import { FooterLinks } from "./footer-links";
import { FooterYear } from "./footer-year";
import { HeaderMascot } from "./header-mascot";

const shop = [
  { href: "/catalog", label: "Каталог" },
  { href: "/sale", label: "Акції" },
  { href: "/brands", label: "Бренди" },
  { href: "/services", label: "Послуги" },
  { href: "/about", label: "Про Полі-Валко" },
  ...(JOURNAL_ENABLED ? [{ href: "/blog", label: "Блог" }] : []),
  { href: "/contacts", label: "Контакти" },
];

const categories = [
  { href: "/catalog/vse-dlia-polyvu", label: "Усе для поливу" },
  { href: "/catalog/vse-dlia-roslyn", label: "Усе для рослин" },
  { href: "/catalog/ruchnyi-instrument", label: "Ручний інструмент" },
  { href: "/catalog/tekhnika-dlia-sadu-ta-horodu", label: "Садова техніка" },
  { href: "/catalog/vse-dlia-vidpochynku", label: "Усе для відпочинку" },
  { href: "/catalog", label: "Усі категорії" },
];

export function SiteFooter() {
  return (
    <footer className="footer" id="footer">
      <div className="container footer__inner">
        <div className="footer__grid">
          <div className="footer__about">
            <Link href="/" prefetch={false} className="brand-logo footer__brand" aria-label="Poli Valko — на головну"><HeaderMascot /><span className="brand-logo__name">Poli-Valko</span></Link>
            <Suspense fallback={null}>
              <FooterContacts />
            </Suspense>
          </div>
          <FooterColumn id="footer-shop" title="Магазин">
            <FooterLinks links={shop} />
          </FooterColumn>
          <FooterColumn id="footer-categories" title="Категорії">
            <FooterLinks links={categories} />
          </FooterColumn>
          <FooterColumn id="footer-buyers" title="Клієнтам">
            <FooterLinks links={purchasePages} />
          </FooterColumn>
        </div>
        <p className="footer__statement">Магазин для саду, городу й дому.</p>
        <div className="footer__legal">
          <p>© <Suspense fallback={null}><FooterYear /></Suspense> Poli-Valko. Усі права захищені.</p>
          <a className="footer__credit" href="https://www.horizon-dynamics.tech/" target="_blank" rel="noopener noreferrer" lang="en">
            <span>Powered by</span>
            <img src="/brand/horizon-emblem.svg" width={16} height={19} alt="" aria-hidden="true" />
            <img src="/brand/horizon-wordmark.svg" width={150} height={11} alt="Horizon Dynamics" />
          </a>
          <div className="footer__legal-links">
            <Link href={privacyPage.href}>{privacyPage.label}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
