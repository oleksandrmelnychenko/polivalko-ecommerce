export const purchasePages = [
  { href: "/payment-delivery", label: "Доставка й оплата", cover: "/brand/delivery-parcel.webp" },
  { href: "/returns", label: "Повернення й обмін", cover: "/brand/returns-parcel.webp" },
  { href: "/offer", label: "Публічна оферта", cover: "/brand/offer-folder.webp" },
];

export const privacyPage = { href: "/privacy", label: "Політика приватності", cover: "/brand/privacy-ledger.webp" };
export const customerPages = [...purchasePages, privacyPage];
