import type { TableChipTone } from '@/shared/ui/TableChip'

const PROVIDERS: Record<string, string> = {
  mono: 'Plata by mono',
  monobank: 'Plata by mono',
  plata: 'Plata by mono',
  sandbox: 'Тестова оплата (Sandbox)',
  stub: 'Тестова заглушка',
  checkbox: 'Checkbox',
  disabled: 'Вимкнено',
  none: 'Не налаштовано',
}

const MODES: Record<string, { label: string; tone: TableChipTone }> = {
  live: { label: 'Робочий режим', tone: 'success' },
  production: { label: 'Робочий режим', tone: 'success' },
  test: { label: 'Тестовий режим', tone: 'warning' },
  sandbox: { label: 'Тестовий режим', tone: 'warning' },
  stub: { label: 'Тестова заглушка', tone: 'warning' },
  disabled: { label: 'Вимкнено', tone: 'neutral' },
  none: { label: 'Не налаштовано', tone: 'neutral' },
}

const RECEIPT_MOMENTS: Record<string, string> = {
  payment: 'Одразу після оплати',
  completion: 'Коли замовлення виконане',
  none: 'Не видається автоматично',
}

export const PAYMENT_METHODS: { key: 'card' | 'cashOnDelivery' | 'pickup'; label: string; hint: string }[] = [
  { key: 'card', label: 'Карткою онлайн', hint: 'Plata by mono на сайті' },
  { key: 'cashOnDelivery', label: 'Післяплата', hint: 'Оплата на Новій пошті під час отримання' },
  { key: 'pickup', label: 'У магазині під час самовивозу', hint: 'Оплата на касі магазину' },
]

export function providerLabel(value: string | null | undefined): string {
  if (!value) return 'Не налаштовано'
  return PROVIDERS[value.toLowerCase()] ?? value
}

export function modeChip(value: string | null | undefined): { label: string; tone: TableChipTone } {
  if (!value) return MODES.none
  return MODES[value.toLowerCase()] ?? { label: value, tone: 'neutral' }
}

export function receiptMomentLabel(value: string | null | undefined): string {
  if (!value) return RECEIPT_MOMENTS.none
  return RECEIPT_MOMENTS[value.toLowerCase()] ?? value
}

export function receiptMomentTone(value: string | null | undefined): TableChipTone {
  const key = value?.toLowerCase()
  return key === 'payment' || key === 'completion' ? 'success' : 'neutral'
}
