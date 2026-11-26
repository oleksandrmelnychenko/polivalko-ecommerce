export const purchasePages = [
  { href: "/payment-delivery", label: "Доставка й оплата", tone: "sage" },
  { href: "/returns", label: "Повернення й обмін", tone: "sand" },
  { href: "/offer", label: "Публічна оферта", tone: "mist" },
];

export const privacyPage = { href: "/privacy", label: "Політика приватності", tone: "sage" };
export const customerPages = [...purchasePages, privacyPage];
