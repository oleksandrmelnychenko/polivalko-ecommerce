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
          <Link href="/" className="logo logo--footer" translate="no">
            PoliValko
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
      <p className="footer__legal">Copyright © 2026 PoliValko. Усі права захищені.</p>
    </footer>
  );
}
