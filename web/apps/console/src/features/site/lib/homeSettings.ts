import type { HomeBlock, HomeBlockKey, HomeItem, HomeSettings } from '../api/siteApi'
import { invalidPeriod, periodDay, periodEnd, periodStart } from './period'

export const HOME_BLOCKS: Record<HomeBlockKey, { name: string; hint: string }> = {
  hero: { name: 'Слайдер першого екрана', hint: 'Банери з вкладки «Банери»' },
  offers: { name: 'Знижки', hint: 'Товари, у яких стара ціна вища за поточну' },
  collections: { name: 'Добірки', hint: 'Видимі добірки з «Каталог → Добірки», у їхньому порядку' },
  categories: { name: 'Розділи каталогу', hint: 'Плитки категорій верхнього рівня' },
  perks: { name: 'Переваги', hint: 'Пункти про доставку, самовивіз і оплату' },
  services: { name: 'Послуги для саду', hint: 'Напрямки з вкладки «Послуги»' },
  steps: { name: 'Як замовити', hint: 'Кроки покупки' },
  visit: { name: 'Наш магазин', hint: 'Адреса, графік і телефон з «Налаштування → Магазин»' },
}

export const DEFAULT_BLOCK_ORDER: HomeBlockKey[] = ['hero', 'offers', 'collections', 'categories', 'perks', 'services', 'steps', 'visit']

export const DEFAULT_PERKS: HomeItem[] = [
  { title: 'Доставка по Україні', text: "Нова пошта: відділення, поштомат або кур'єр. Доставку оплачуєте за тарифами перевізника." },
  { title: 'Самовивіз', text: 'Безкоштовно. Забирайте, коли менеджер повідомить, що замовлення зібране.' },
  { title: 'Оплата', text: 'Карткою на сайті, післяплатою на Новій пошті або в магазині.' },
  { title: 'Звіряємо зі складом', text: 'Ціну й залишок перевіряємо в магазині до того, як підтвердити замовлення.' },
]

export const DEFAULT_STEPS: HomeItem[] = [
  { title: 'Оберіть товари', text: 'Знайдіть товар за назвою чи артикулом або відкрийте потрібний розділ каталогу.' },
  { title: 'Оформіть без реєстрації', text: 'Достатньо імені й телефону. Ціну й залишок звіримо зі складом перед підтвердженням.' },
  { title: 'Отримайте замовлення', text: 'Новою поштою в будь-якому місті України. Або заберіть самі з магазину, це безкоштовно.' },
]

export const DEFAULT_VISIT: HomeItem = { title: 'Наш магазин', text: 'Товар можна подивитися перед покупкою, а замовлення забрати безкоштовно.' }

export const LIMITS = {
  announcementText: 160,
  link: 300,
  itemTitle: 80,
  itemText: 300,
  visitTitle: 80,
  visitText: 200,
  perks: 6,
  steps: 6,
} as const

export type ItemRow = HomeItem & { id: string }

export type HomeForm = {
  blocks: HomeBlock[]
  announcement: { text: string; link: string; isActive: boolean; from: string; to: string }
  perks: ItemRow[]
  steps: ItemRow[]
  visit: HomeItem
}

let rowSeed = 0

export function itemRows(items: HomeItem[]): ItemRow[] {
  return items.map((item) => newItemRow(item))
}

export function newItemRow(item: HomeItem = { title: '', text: '' }): ItemRow {
  rowSeed += 1
  return { id: `row-${rowSeed}`, title: item.title ?? '', text: item.text ?? '' }
}

export function blockName(key: string): string {
  return key in HOME_BLOCKS ? HOME_BLOCKS[key as HomeBlockKey].name : key
}

export function blockHint(key: string): string {
  return key in HOME_BLOCKS ? HOME_BLOCKS[key as HomeBlockKey].hint : ''
}

export function toHomeForm(value: Partial<HomeSettings> | undefined): HomeForm {
  const announcement = value?.announcement
  return {
    blocks: normalizeBlocks(value?.blocks),
    announcement: {
      text: announcement?.text ?? '',
      link: announcement?.link ?? '',
      isActive: announcement?.isActive ?? false,
      from: periodDay(announcement?.startsAt),
      to: periodDay(announcement?.endsAt),
    },
    perks: itemRows(value?.perks ?? DEFAULT_PERKS),
    steps: itemRows(value?.steps ?? DEFAULT_STEPS),
    visit: { title: value?.visit?.title ?? DEFAULT_VISIT.title, text: value?.visit?.text ?? DEFAULT_VISIT.text },
  }
}

export function toHomeBody(form: HomeForm): HomeSettings {
  const clean = (items: ItemRow[]) => items.map((item) => ({ title: item.title.trim(), text: item.text.trim() }))
  return {
    blocks: form.blocks.map((block) => ({ key: block.key, visible: block.visible })),
    announcement: {
      text: form.announcement.text.trim(),
      link: form.announcement.link.trim() || null,
      isActive: form.announcement.isActive,
      startsAt: periodStart(form.announcement.from),
      endsAt: periodEnd(form.announcement.to),
    },
    perks: clean(form.perks),
    steps: clean(form.steps),
    visit: { title: form.visit.title.trim(), text: form.visit.text.trim() },
  }
}

export function validateHome(form: HomeForm): Record<string, string> {
  const errors: Record<string, string> = {}
  const announcement = form.announcement
  if (announcement.isActive && !announcement.text.trim()) errors['announcement.text'] = 'Вкажіть текст оголошення або вимкніть смугу.'
  if (announcement.link.trim() && !isLink(announcement.link.trim())) errors['announcement.link'] = 'Посилання має починатися з / або https://.'
  if (invalidPeriod(announcement.from, announcement.to)) errors['announcement.endsAt'] = 'Дата завершення раніше за дату початку.'
  checkItems(form.perks, 'perks', errors)
  checkItems(form.steps, 'steps', errors)
  if (!form.visit.title.trim()) errors['visit.title'] = 'Вкажіть заголовок блоку.'
  return errors
}

export function isLink(value: string): boolean {
  return value.startsWith('/') || /^https?:\/\/\S+$/i.test(value)
}

function checkItems(items: ItemRow[], prefix: string, errors: Record<string, string>) {
  items.forEach((item, index) => {
    if (!item.title.trim()) errors[`${prefix}.${index}.title`] = 'Вкажіть заголовок.'
  })
}

function normalizeBlocks(blocks: HomeBlock[] | undefined): HomeBlock[] {
  const list = (blocks ?? []).filter((block, index, all) => block.key && all.findIndex((item) => item.key === block.key) === index)
  const seen = new Set(list.map((block) => block.key))
  return [...list.map((block) => ({ key: block.key, visible: Boolean(block.visible) })), ...DEFAULT_BLOCK_ORDER.filter((key) => !seen.has(key)).map((key) => ({ key, visible: true }))]
}

export function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}
