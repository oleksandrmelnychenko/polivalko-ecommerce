const balanceHeadings = ['Назва', 'На початок', 'Прихід', 'Розхід', 'Залишок']
const reportScopes: ReadonlyMap<string, string> = new Map([
  ['Звіт по рахунках', 'accounts'],
  ['Звіт по касі', 'cashboxes'],
])
const amountPattern = /^([+\-−]?)(\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)[.,](\d{2})[ \u00a0\u202f]*грн\.$/u
const maxReportRows = 500

type BalanceCheck = { matched: number; different: number; unavailable: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonemptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(`${value}T`)
}

function readCells(row: Record<string, unknown>): string[] | null {
  if (!Array.isArray(row.cells) || row.cells.length !== balanceHeadings.length) return null
  const values: string[] = []
  for (const cell of row.cells) {
    if (!isRecord(cell) || cell.colspan !== 1 || cell.rowspan !== 1 || typeof cell.value !== 'string') return null
    values.push(cell.value.trim())
  }
  return values
}

function minorUnits(value: string): bigint | null {
  if (value.length > 64) return null
  const parts = amountPattern.exec(value)
  if (!parts) return null
  const [, sign, major, minor] = parts
  const amount = BigInt(major.replace(/[ \u00a0\u202f]/gu, '')) * 100n + BigInt(minor)
  return sign === '-' || sign === '−' ? -amount : amount
}

export function checkArchivedBalances(original: unknown): BalanceCheck | null {
  if (!isRecord(original) || original.schemaVersion !== 1 || original.source !== 'dntrade' ||
      original.entityType !== 'financialReport' || typeof original.documentType !== 'string' ||
      (original.currency != null && original.currency !== 'UAH') || !isRecord(original.raw)) return null

  const scopeField = reportScopes.get(original.documentType)
  const { scope, period, tables } = original.raw
  if (!scopeField || !isRecord(scope) || !isNonemptyText(scope.organization) || !isNonemptyText(scope[scopeField]) ||
      !isRecord(period) || period.timezone !== 'Europe/Kyiv' || !isDate(period.from) || !isDate(period.to) ||
      period.from > period.to || period.to !== original.sourceDate || !Array.isArray(tables) || tables.length !== 1) return null

  const [table] = tables
  if (!Array.isArray(table) || table.length === 0 || table.length > maxReportRows) return null
  const [header, ...rows] = table
  if (!isRecord(header) || header.section !== 'THEAD') return null
  const headings = readCells(header)
  if (!headings || balanceHeadings.some((heading, index) => headings[index] !== heading)) return null

  const result: BalanceCheck = { matched: 0, different: 0, unavailable: 0 }
  for (const row of rows) {
    if (!isRecord(row) || (row.section !== 'TBODY' && row.section !== 'TFOOT')) return null
    if (row.section === 'TFOOT') continue
    const values = readCells(row)
    if (!values || !isNonemptyText(values[0])) {
      result.unavailable++
      continue
    }
    const [opening, income, expense, closing] = values.slice(1).map(minorUnits)
    if (opening === null || income === null || expense === null || closing === null) {
      result.unavailable++
    } else if (opening + income - expense === closing) {
      result.matched++
    } else {
      result.different++
    }
  }
  return result
}
