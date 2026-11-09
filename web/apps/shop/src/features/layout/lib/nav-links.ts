export type NavLink = { href: string; label: string };

export const saleLink: NavLink = { href: "/sale", label: "Акції" };

export const pageLinks: NavLink[] = [
  { href: "/services", label: "Послуги" },
  { href: "/payment-delivery", label: "Доставка й оплата" },
  { href: "/contacts", label: "Контакти" },
];

export const mobilePageLinks: NavLink[] = [
  { href: "/services", label: "Послуги" },
  { href: "/payment-delivery", label: "Доставка й оплата" },
  { href: "/returns", label: "Повернення" },
  { href: "/contacts", label: "Контакти" },
];
