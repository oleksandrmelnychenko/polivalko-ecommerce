import type { LabelKind, LabelTone, ProductLabel } from '../api/dictionariesApi'

export const LABEL_TONES: { value: LabelTone; label: string }[] = [
  { value: 'green', label: 'Зелений' },
  { value: 'red', label: 'Червоний' },
  { value: 'orange', label: 'Помаранчевий' },
  { value: 'blue', label: 'Синій' },
  { value: 'gray', label: 'Сірий' },
  { value: 'dark', label: 'Темний' },
]

export const LABEL_KIND_LABELS: Record<LabelKind, string> = {
  manual: 'Вручну',
  sale: 'Автоматично',
  new: 'Автоматично',
}

export const DEFAULT_NEW_DAYS = 30

export function isAutoLabel(label: { kind: LabelKind }): boolean {
  return label.kind !== 'manual'
}

export function labelRule(label: Pick<ProductLabel, 'kind' | 'newDays'>): string {
  if (label.kind === 'sale') return 'Коли стара ціна з Navkolo більша за поточну'
  if (label.kind === 'new') return `Перші ${label.newDays ?? DEFAULT_NEW_DAYS} дн. після появи товару`
  return 'Ставлять у картці товару або масово у списку'
}

export function canDeleteLabel(label: Pick<ProductLabel, 'kind' | 'isActive'>): boolean {
  return label.kind === 'manual' || !label.isActive
}

export function sortLabels<T extends { sortOrder: number; name: string }>(labels: readonly T[]): T[] {
  return [...labels].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'uk'))
}

export function manualLabelOptions(labels: readonly ProductLabel[]) {
  return sortLabels(labels.filter((label) => label.kind === 'manual')).map((label) => ({
    value: label.id,
    label: label.isActive ? label.name : `${label.name} (вимкнена)`,
  }))
}
