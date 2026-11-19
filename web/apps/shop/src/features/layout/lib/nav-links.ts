import { JOURNAL_ENABLED } from "@/features/journal";

export type NavLink = { href: string; label: string };

export const saleLink: NavLink = { href: "/sale", label: "Акції" };

export const pageLinks: NavLink[] = [
  { href: "/about", label: "Про нас" },
  { href: "/services", label: "Послуги" },
  ...(JOURNAL_ENABLED ? [{ href: "/blog", label: "Блог" }] : []),
  { href: "/contacts", label: "Контакти" },
];

export const mobilePageLinks: NavLink[] = [
  { href: "/about", label: "Про нас" },
  ...(JOURNAL_ENABLED ? [{ href: "/blog", label: "Блог" }] : []),
  { href: "/services", label: "Послуги" },
  { href: "/payment-delivery", label: "Доставка й оплата" },
  { href: "/returns", label: "Повернення" },
  { href: "/contacts", label: "Контакти" },
];
