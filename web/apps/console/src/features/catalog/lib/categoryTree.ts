import type { ConsoleCategory } from '../api/catalogApi'

export type CategoryOption = { value: string; label: string }

export type OrderedCategory = ConsoleCategory & { depth: number; hiddenByParent: boolean }

export function orderCategories(all: ConsoleCategory[]): OrderedCategory[] {
  const byParent = new Map<string | null, ConsoleCategory[]>()
  for (const category of all) {
    const key = category.parentId && all.some((c) => c.id === category.parentId) ? category.parentId : null
    const list = byParent.get(key) ?? []
    list.push(category)
    byParent.set(key, list)
  }
  const ordered: OrderedCategory[] = []
  const seen = new Set<string>()
  const walk = (parentId: string | null, depth: number, hiddenByParent: boolean) => {
    for (const category of byParent.get(parentId) ?? []) {
      if (seen.has(category.id)) continue
      seen.add(category.id)
      ordered.push({ ...category, depth, hiddenByParent })
      walk(category.id, depth + 1, hiddenByParent || !category.isVisible)
    }
  }
  walk(null, 0, false)
  return ordered
}

export function descendantIds(all: ConsoleCategory[], id: string): Set<string> {
  const ids = new Set<string>([id])
  for (let added = true; added; ) {
    added = false
    for (const category of all) {
      if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id)
        added = true
      }
    }
  }
  return ids
}

export function consoleCategoryOptions(all: ConsoleCategory[]): CategoryOption[] {
  return orderCategories(all).map((category) => ({
    value: category.id,
    label: `${'· '.repeat(category.depth)}${category.name}${isHidden(category) ? ' (прихована)' : ''}`,
  }))
}

export function isHidden(category: OrderedCategory): boolean {
  return !category.isVisible || category.hiddenByParent
}
