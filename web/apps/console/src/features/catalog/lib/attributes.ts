import type { AttributeDefinition, AttributeFilterView, AttributeKind } from '../api/dictionariesApi'

export const ATTRIBUTE_KIND_OPTIONS: { value: AttributeKind; label: string }[] = [
  { value: 'list', label: 'Список' },
  { value: 'number', label: 'Число' },
  { value: 'boolean', label: 'Так / ні' },
]

export const FILTER_VIEW_OPTIONS: { value: AttributeFilterView; label: string }[] = [
  { value: 'checkboxes', label: 'Прапорці' },
  { value: 'range', label: 'Діапазон' },
]

export const ATTRIBUTE_KIND_LABELS: Record<AttributeKind, string> = { list: 'Список', number: 'Число', boolean: 'Так / ні' }
export const FILTER_VIEW_LABELS: Record<AttributeFilterView, string> = { checkboxes: 'Прапорці', range: 'Діапазон' }

export function sortAttributes(list: readonly AttributeDefinition[]): AttributeDefinition[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'uk'))
}

export function matchesAttribute(attribute: AttributeDefinition, term: string): boolean {
  if (!term) return true
  const needle = term.toLowerCase()
  return attribute.name.toLowerCase().includes(needle) || attribute.aliases.some((alias) => alias.toLowerCase().includes(needle))
}
