export function contactPhones(contacts?: { storePhone?: string | null; servicesPhone?: string | null; schedule?: string | null } | null) {
  return [
    { label: "Магазин", number: contacts?.storePhone?.trim(), schedule: contacts?.schedule },
    { label: "Послуги", number: contacts?.servicesPhone?.trim() },
  ].map((phone) => ({ ...phone, dial: phone.number?.replace(/[^\d+]/g, "") }))
    .filter((phone, index, all) => phone.dial && all.findIndex((other) => other.dial === phone.dial) === index);
}
