import type { TableChipTone } from '@/shared/ui/TableChip'

const seasons = new Map<string, { label: string; tone: TableChipTone }>([
  ['in_season', { label: 'У сезоні', tone: 'success' }],
  ['all_year', { label: 'Цілорічний', tone: 'neutral' }],
  ['off_season', { label: 'Не сезон', tone: 'warning' }],
])
const sources = new Map([
  ['rule', 'правило'],
  ['product', 'історія товару'],
  ['category', 'історія категорії'],
  ['department', 'історія відділу'],
  ['none', 'немає даних'],
])

export const seasonLabel = (season: string): string => seasons.get(season)?.label ?? season
export const seasonTone = (season: string): TableChipTone => seasons.get(season)?.tone ?? 'neutral'
export const sourceLabel = (source: string): string => sources.get(source) ?? source
/** The season of a product with what decided it, for a tooltip. */
export const seasonReason = (season: string, source: string): string => `${seasonLabel(season)} · ${sourceLabel(source)}`
