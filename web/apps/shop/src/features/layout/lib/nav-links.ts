export type NavLink = { href: string; label: string };

export const homeLinks: NavLink[] = [
  { href: "/#offers-title", label: "Знижки" },
  { href: "/#collection-title", label: "Рекомендовані товари" },
  { href: "/#sections-title", label: "Розділи каталогу" },
  { href: "/#services-title", label: "Послуги для саду" },
  { href: "/#steps-title", label: "Як замовити" },
  { href: "/#visit-title", label: "Магазин у Бучі" },
];

export const buyerLinks: NavLink[] = [
  { href: "/payment-delivery", label: "Доставка й оплата" },
  { href: "/returns", label: "Повернення" },
  { href: "/offer", label: "Публічна оферта" },
  { href: "/privacy", label: "Політика приватності" },
];

export const contactLinks: NavLink[] = [
  { href: "/contacts", label: "Контакти й маршрут" },
  { href: "/payment-delivery", label: "Самовивіз у Бучі" },
  { href: "/services", label: "Замовити послугу" },
];
