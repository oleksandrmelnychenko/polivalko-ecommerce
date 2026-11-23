const YEARLY = ['invoices', 'markets']

// The address of the business analytics page after a change of section or filter.
export function nextReportParams(current: URLSearchParams, tab: string, changes: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams(current)
  if (!('page' in changes)) p.delete('page')
  if (changes.tab && changes.tab !== tab) {
    for (const key of ['season', 'week', 'partner']) p.delete(key)
    if (tab === 'markets') for (const name of ['region', 'source', 'metric', 'carrier']) p.delete(name)
    // The year passes only between the two yearly reports. Kept through another section, it would
    // come back later and open a report on an old year instead of the newest one.
    if (!YEARLY.includes(tab) || !YEARLY.includes(changes.tab)) p.delete('year')
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) p.set(key, value)
    else p.delete(key)
  }
  return p
}
