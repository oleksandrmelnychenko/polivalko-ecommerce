import type { Contacts, ShopSettings, SpecialDay } from '../api/settingsApi'

export type SpecialDayRow = { id: string; date: string; label: string; closed: boolean; hours: string }

export type ContactValues = {
  storePhone: string
  servicesPhone: string
  email: string
  address: string
  mapUrl: string
  schedule: string
  instagram: string
  facebook: string
  telegram: string
  viber: string
  youTube: string
}

export type SellerValues = { name: string; taxId: string; address: string; iban: string; email: string; phone: string }

export type ShopForm = {
  contacts: ContactValues
  specialDays: SpecialDayRow[]
  seller: SellerValues
}

export const SELLER_LIMITS: Record<keyof SellerValues, number> = { name: 200, taxId: 20, address: 300, iban: 40, email: 200, phone: 30 }

export const SHOP_LIMITS = { label: 60, hours: 60, schedule: 300, address: 300, phone: 30, email: 200 } as const

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const WEB_LINK = /^https?:\/\/\S+$/i

let rowSeed = 0

export function newSpecialDay(day?: SpecialDay): SpecialDayRow {
  rowSeed += 1
  return { id: `day-${rowSeed}`, date: day?.date?.slice(0, 10) ?? '', label: day?.label ?? '', closed: day?.closed ?? true, hours: day?.hours ?? '' }
}

export function toShopForm(contacts: Contacts, shop: ShopSettings): ShopForm {
  const seller = shop.seller
  return {
    contacts: {
      storePhone: contacts.storePhone ?? '',
      servicesPhone: contacts.servicesPhone ?? '',
      email: contacts.email ?? '',
      address: contacts.address ?? '',
      mapUrl: contacts.mapUrl ?? '',
      schedule: contacts.schedule ?? '',
      instagram: contacts.instagram ?? '',
      facebook: contacts.facebook ?? '',
      telegram: contacts.telegram ?? '',
      viber: contacts.viber ?? '',
      youTube: contacts.youTube ?? '',
    },
    specialDays: (shop.specialDays ?? []).map((day) => newSpecialDay(day)),
    seller: {
      name: seller?.name ?? '',
      taxId: seller?.taxId ?? '',
      address: seller?.address ?? '',
      iban: seller?.iban ?? '',
      email: seller?.email ?? '',
      phone: seller?.phone ?? '',
    },
  }
}

const orNull = (value: string) => value.trim() || null

export function toContactsBody(form: ShopForm): Contacts {
  const values = form.contacts
  return {
    storePhone: orNull(values.storePhone),
    servicesPhone: orNull(values.servicesPhone),
    email: orNull(values.email),
    address: orNull(values.address),
    schedule: orNull(values.schedule),
    mapUrl: orNull(values.mapUrl),
    instagram: orNull(values.instagram),
    facebook: orNull(values.facebook),
    telegram: orNull(values.telegram),
    youTube: orNull(values.youTube),
    viber: orNull(values.viber),
  }
}

export function toShopBody(form: ShopForm): ShopSettings {
  return {
    seller: {
      name: form.seller.name.trim(),
      taxId: orNull(form.seller.taxId.replace(/\s+/g, '')),
      address: orNull(form.seller.address),
      iban: orNull(form.seller.iban.replace(/\s+/g, '').toUpperCase()),
      email: orNull(form.seller.email),
      phone: orNull(form.seller.phone),
    },
    specialDays: [...form.specialDays]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({ date: day.date, label: day.label.trim(), closed: day.closed, hours: day.closed ? null : orNull(day.hours) })),
  }
}

export function validateShop(form: ShopForm): Record<string, string> {
  const errors: Record<string, string> = {}
  const contacts = form.contacts
  const webLink = (key: keyof ContactValues) => {
    const value = contacts[key].trim()
    if (value && !WEB_LINK.test(value)) errors[key] = 'Вкажіть повне посилання, що починається з https://.'
  }
  if (contacts.email.trim() && !EMAIL.test(contacts.email.trim())) errors.email = 'Перевірте email.'
  webLink('mapUrl')
  webLink('instagram')
  webLink('facebook')
  webLink('telegram')
  webLink('youTube')
  const viber = contacts.viber.trim()
  if (viber && !/^(https?:\/\/|viber:\/\/)\S+$/i.test(viber)) errors.viber = 'Вкажіть посилання, що починається з viber:// або https://.'

  const seen = new Set<string>()
  form.specialDays.forEach((day, index) => {
    if (!DAY.test(day.date)) errors[`specialDays.${index}.date`] = 'Вкажіть дату.'
    else if (seen.has(day.date)) errors[`specialDays.${index}.date`] = 'Ця дата вже є в списку.'
    seen.add(day.date)
    if (!day.label.trim()) errors[`specialDays.${index}.label`] = 'Вкажіть, що це за день.'
    if (!day.closed && !day.hours.trim()) errors[`specialDays.${index}.hours`] = 'Вкажіть години або позначте «Зачинено».'
  })

  const seller = form.seller
  if (!seller.name.trim()) errors['seller.name'] = 'Вкажіть назву продавця.'
  const taxId = seller.taxId.replace(/\s+/g, '')
  if (taxId && !/^(\d{8}|\d{10})$/.test(taxId)) errors['seller.taxId'] = 'ЄДРПОУ має 8 цифр, РНОКПП має 10 цифр.'
  const iban = seller.iban.replace(/\s+/g, '').toUpperCase()
  if (iban && !/^UA\d{27}$/.test(iban)) errors['seller.iban'] = 'IBAN має вигляд UA і 27 цифр.'
  if (seller.email.trim() && !EMAIL.test(seller.email.trim())) errors['seller.email'] = 'Перевірте email.'
  return errors
}

export function isPastDay(day: string): boolean {
  if (!DAY.test(day)) return false
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return day < today
}
