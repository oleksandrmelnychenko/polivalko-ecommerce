import type { Contacts } from "@polivalko/shared/api/types";

type ContactName = keyof Contacts;

export const contactGroups: { legend: string; fields: { name: ContactName; label: string; type?: "tel" | "email" | "url"; multiline?: boolean; placeholder?: string }[] }[] = [
  {
    legend: "Зв'язок",
    fields: [
      { name: "storePhone", label: "Телефон магазину", type: "tel", placeholder: "+380 67 123 45 67" },
      { name: "servicesPhone", label: "Телефон послуг", type: "tel", placeholder: "+380 67 123 45 67" },
      { name: "email", label: "Email", type: "email" },
    ],
  },
  {
    legend: "Магазин",
    fields: [
      { name: "address", label: "Адреса" },
      { name: "mapUrl", label: "Посилання на карту", type: "url", placeholder: "https://maps.app.goo.gl/…" },
      { name: "schedule", label: "Графік роботи", multiline: true },
    ],
  },
  {
    legend: "Соцмережі",
    fields: [
      { name: "instagram", label: "Instagram", type: "url", placeholder: "https://instagram.com/…" },
      { name: "facebook", label: "Facebook", type: "url", placeholder: "https://facebook.com/…" },
      { name: "telegram", label: "Telegram", type: "url", placeholder: "https://t.me/…" },
      { name: "youTube", label: "YouTube", type: "url", placeholder: "https://youtube.com/@…" },
    ],
  },
];

export const toContactValues = (c: Contacts) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ""])) as Record<ContactName, string>;
