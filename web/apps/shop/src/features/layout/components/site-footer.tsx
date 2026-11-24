import Link from "next/link";
import { JOURNAL_ENABLED } from "@/features/journal";
import { Suspense } from "react";
import { FooterColumn } from "./footer-column";
import { FooterContacts } from "./footer-contacts";
import { FooterLinks } from "./footer-links";
import { FooterSeller } from "./footer-seller";
import { FooterYear } from "./footer-year";
import { HeaderMascot } from "./header-mascot";

const shop = [
  { href: "/catalog", label: "Каталог" },
  { href: "/sale", label: "Акції" },
  { href: "/services", label: "Послуги" },
  { href: "/about", label: "Про Полі-Валько" },
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

const buyers = [
  { href: "/payment-delivery", label: "Доставка й оплата" },
  { href: "/returns", label: "Повернення й обмін" },
  { href: "/offer", label: "Публічна оферта" },
];

export function SiteFooter() {
  return (
    <footer className="footer" id="footer">
      <div className="container footer__inner">
        <div className="footer__grid">
          <div className="footer__about">
            <Link href="/" className="brand-logo footer__brand" aria-label="Poli-Valko — на головну"><HeaderMascot /><span className="brand-logo__name">Poli-Valko</span></Link>
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
            <FooterLinks links={buyers} />
          </FooterColumn>
        </div>
        <p className="footer__statement">Магазин для саду, городу й дому в Бучі.</p>
        <div className="footer__legal">
          <div>
            <p>© <Suspense fallback={null}><FooterYear /></Suspense> Poli-Valko. Усі права захищені.</p>
            <Suspense fallback={null}><FooterSeller /></Suspense>
          </div>
          <div className="footer__legal-links">
            <Link href="/privacy">Політика приватності</Link>
            <Link href="/credits">Автори фото</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
