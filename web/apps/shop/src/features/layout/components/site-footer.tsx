import Link from "next/link";
import { Suspense } from "react";
import { FooterColumn } from "./footer-column";
import { FooterContacts } from "./footer-contacts";
import { FooterLinks } from "./footer-links";
import { FooterSeller } from "./footer-seller";
import { FooterServices } from "./footer-services";

const shop = [
  { href: "/catalog", label: "Каталог" },
  { href: "/sale", label: "Акції" },
  { href: "/contacts", label: "Контакти" },
];

const buyers = [
  { href: "/payment-delivery", label: "Доставка й оплата" },
  { href: "/returns", label: "Повернення й обмін" },
  { href: "/offer", label: "Публічна оферта" },
  { href: "/privacy", label: "Політика приватності" },
];

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__about">
          <Link href="/" className="brand-logo" aria-label="Poli-Valko, на головну" translate="no">
            <img className="brand-logo__emblem" src="/mascot/poli-valka-poster.png" width={253} height={450} alt="" />
            <span className="brand-logo__wordmark">
              <span className="brand-logo__name">Poli-Valko</span>
              <span className="brand-logo__tagline">Дім · сад · город</span>
            </span>
          </Link>
          <p>Товари для саду, городу й дому. Відправляємо Новою поштою по всій Україні.</p>
          <Suspense fallback={null}>
            <FooterSeller />
          </Suspense>
        </div>
        <FooterColumn id="footer-shop" title="Магазин">
          <FooterLinks links={shop} />
        </FooterColumn>
        <FooterColumn id="footer-buyers" title="Покупцям">
          <FooterLinks links={buyers} />
        </FooterColumn>
        <FooterColumn id="footer-contacts" title="Контакти" as="div">
          <Suspense fallback={null}>
            <FooterContacts />
          </Suspense>
        </FooterColumn>
        <FooterColumn id="footer-services" title="Послуги">
          <Suspense fallback={null}>
            <FooterServices />
          </Suspense>
        </FooterColumn>
      </div>
      <p className="footer__legal">
        © 2026 Poli-Valko. <Link href="/credits">Автори фото</Link>
      </p>
    </footer>
  );
}
