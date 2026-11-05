import type { Problem } from '@/shared/api/problem'
import type { PermissionDefinition, PermissionRisk } from '@/shared/auth/permissionsApi'

export type PermissionSection = { id: string; label: string; permissions: PermissionDefinition[] }
export type RiskFilter = 'all' | PermissionRisk
export type StateFilter = 'all' | 'selected' | 'unselected' | 'changed'
export type PermissionFilters = { query: string; risk: RiskFilter; state: StateFilter }

export const EMPTY_FILTERS: PermissionFilters = { query: '', risk: 'all', state: 'all' }

export const RISK_LABELS: Record<PermissionRisk, string> = {
  low: 'Низький ризик',
  medium: 'Середній ризик',
  high: 'Високий ризик',
}

export function buildSections(permissions: readonly PermissionDefinition[]): PermissionSection[] {
  const sections = new Map<string, PermissionSection>()
  for (const permission of permissions) {
    const section = sections.get(permission.sectionId) ?? { id: permission.sectionId, label: permission.sectionLabel, permissions: [] }
    section.permissions.push(permission)
    sections.set(permission.sectionId, section)
  }
  return [...sections.values()]
}

export function hasActiveFilters(filters: PermissionFilters): boolean {
  return Boolean(filters.query.trim()) || filters.risk !== 'all' || filters.state !== 'all'
}

export function filterPermissions(
  permissions: readonly PermissionDefinition[],
  filters: PermissionFilters,
  selected: ReadonlySet<string>,
  baseline: ReadonlySet<string>,
): PermissionDefinition[] {
  const query = filters.query.trim().toLocaleLowerCase('uk')
  return permissions.filter((permission) => {
    if (filters.risk !== 'all' && permission.risk !== filters.risk) return false
    const isSelected = selected.has(permission.key)
    if (filters.state === 'selected' && !isSelected) return false
    if (filters.state === 'unselected' && isSelected) return false
    if (filters.state === 'changed' && isSelected === baseline.has(permission.key)) return false
    if (!query) return true
    return [permission.name, permission.description, permission.key, permission.sectionLabel, RISK_LABELS[permission.risk]]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('uk')
      .includes(query)
  })
}

export function selectionState(keys: readonly string[], selected: ReadonlySet<string>) {
  const count = keys.reduce((sum, key) => sum + (selected.has(key) ? 1 : 0), 0)
  return { count, checked: keys.length > 0 && count === keys.length, indeterminate: count > 0 && count < keys.length }
}

export function toggleKeys(selected: ReadonlySet<string>, keys: readonly string[]): Set<string> {
  const next = new Set(selected)
  const select = keys.some((key) => !next.has(key))
  for (const key of keys) {
    if (select) next.add(key)
    else next.delete(key)
  }
  return next
}

export function diffKeys(baseline: ReadonlySet<string>, selected: ReadonlySet<string>) {
  return {
    added: [...selected].filter((key) => !baseline.has(key)),
    removed: [...baseline].filter((key) => !selected.has(key)),
  }
}

export function orderKeys(keys: ReadonlySet<string>, catalog: readonly PermissionDefinition[]): string[] {
  const known = catalog.filter((permission) => keys.has(permission.key)).map((permission) => permission.key)
  const knownSet = new Set(known)
  return [...known, ...[...keys].filter((key) => !knownSet.has(key)).sort()]
}

export function problemKeys(problem: Problem | undefined, extension: 'missingKeys' | 'unknownKeys'): string[] {
  const value = problem?.[extension]
  if (Array.isArray(value)) return value.filter((key): key is string => typeof key === 'string')
  return problem?.detail ? problem.detail.split(',').map((key) => key.trim()).filter(Boolean) : []
}

export function permissionNames(keys: readonly string[], catalog: readonly PermissionDefinition[]): string {
  const names = new Map(catalog.map((permission) => [permission.key, permission.name]))
  return keys.map((key) => `«${names.get(key) ?? key}»`).join(', ')
}
