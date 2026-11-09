import Link from "next/link";
import { Suspense } from "react";
import { FooterColumn } from "./footer-column";
import { FooterContacts } from "./footer-contacts";
import { FooterLinks } from "./footer-links";
import { FooterSeller } from "./footer-seller";
import { FooterServices } from "./footer-services";

const information = [
  { href: "/payment-delivery", label: "Доставка й оплата" },
  { href: "/returns", label: "Повернення" },
  { href: "/offer", label: "Публічна оферта" },
  { href: "/privacy", label: "Політика приватності" },
];

const buyers = [
  { href: "/catalog", label: "Каталог" },
  { href: "/services", label: "Заявка на послуги" },
  { href: "/contacts", label: "Контакти" },
  { href: "/credits", label: "Автори фото" },
];

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__about">
          <Link href="/" className="brand-logo" aria-label="Poli-Valko — на головну" translate="no">
            <img className="brand-logo__emblem" src="/mascot/poli-valka-poster.png" width={253} height={450} alt="" />
            <span className="brand-logo__wordmark">
              <span className="brand-logo__name">Poli-Valko</span>
              <span className="brand-logo__tagline">Дім · сад · город</span>
            </span>
          </Link>
          <p>Товари для дому, саду та городу з магазину в Бучі. Відправляємо Новою поштою по всій Україні або чекаємо на самовивіз.</p>
          <Suspense fallback={null}>
            <FooterSeller />
          </Suspense>
        </div>
        <FooterColumn id="footer-info" title="Інформація">
          <FooterLinks links={information} />
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
      <p className="footer__legal">Copyright © 2026 Poli-Valko. Усі права захищені.</p>
    </footer>
  );
}
