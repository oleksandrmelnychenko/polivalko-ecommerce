import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { getContacts, getServiceDirections } from "@/lib/catalog";
import { ClockIcon, PhoneIcon, PinIcon } from "./icons";

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

/** Футер як у референсі: про магазин, «Інформація», «Покупцям», «Контакти», «Послуги» (короткий блок послуг, розділ 3 ТЗ). */
export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__about">
          <Link href="/" className="logo logo--footer" translate="no">
            PoliValko
          </Link>
          <p>Товари для дому, саду та городу з магазину в Бучі. Відправляємо Новою поштою по всій Україні або чекаємо на самовивіз.</p>
          <p>Прототип магазину: товари й ціни демонстраційні, фото тимчасові, з Unsplash.</p>
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

function FooterColumn({ id, title, as = "nav", children }: { id: string; title: string; as?: "nav" | "div"; children: ReactNode }) {
  const Tag = as;
  return (
    <Tag className="footer__col" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </Tag>
  );
}

function FooterLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <ul className="footer__links">
      {links.map((link) => (
        <li key={link.label}>
          <Link href={link.href}>{link.label}</Link>
        </li>
      ))}
    </ul>
  );
}

async function FooterServices() {
  await connection();
  const directions = await getServiceDirections();
  return <FooterLinks links={directions.slice(0, 5).map((d) => ({ href: "/services", label: d.name }))} />;
}

async function FooterContacts() {
  await connection();
  const contacts = await getContacts();
  return (
    <ul className="footer__contacts">
      <li>
        <PinIcon />
        <span>{contacts?.address ?? <span className="fill">Буча, адреса уточнюється</span>}</span>
      </li>
      <li>
        <ClockIcon />
        <span>{contacts?.schedule ?? <span className="fill">графік уточнюється</span>}</span>
      </li>
      {contacts?.storePhone && (
        <li>
          <PhoneIcon />
          <span>
            Телефон: <a href={`tel:${contacts.storePhone.replace(/[^\d+]/g, "")}`}>{contacts.storePhone}</a>
          </span>
        </li>
      )}
    </ul>
  );
}
