const maxTables = 12
const maxRows = 1000
const maxCells = 5000
const maxColumns = 64
const maxCellLength = 4096

type ReportCell = { value: string; colspan: number; rowspan: number }
type ReportRow = ReportCell[]
type ReportTable = { THEAD: ReportRow[]; TBODY: ReportRow[]; TFOOT: ReportRow[] }

export type ReportField = { label: string; value: string }
type ReportFieldGroup = { title?: string; fields: ReportField[] }

export type FinancialReportPreview =
  | { kind: 'tables'; tables: ReportTable[]; limited: boolean; fields: ReportField[] }
  | { kind: 'fields'; groups: ReportFieldGroup[] }
  | { kind: 'empty' | 'unsupported' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSpan(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max
}

function isSourceText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= maxCellLength
}

function sourceField(label: string, value: unknown): ReportField[] {
  return isSourceText(value) && value !== '' ? [{ label, value }] : []
}

function reportScope(raw: Record<string, unknown>): ReportField[] {
  const period = isRecord(raw.period) ? raw.period : {}
  const scope = isRecord(raw.scope) ? raw.scope : {}
  const dates = isSourceText(period.from) && isSourceText(period.to) ? `${period.from} — ${period.to}` : undefined
  const organizations = scope.organization ?? scope.organizations
  const organizationText = Array.isArray(organizations) && organizations.length <= 50 && organizations.every(isSourceText)
    ? organizations.join(', ')
    : organizations
  return [
    ...sourceField('Період звіту', dates),
    ...sourceField('Часовий пояс', period.timezone),
    ...sourceField('Організації', organizationText),
    ...sourceField('Каси', scope.cashboxes),
    ...sourceField('Банківські рахунки', scope.accounts),
  ]
}

function parseStructuredReport(entityType: unknown, documentType: unknown, raw: Record<string, unknown>): FinancialReportPreview {
  if (entityType === 'bankAccount' && documentType === 'Банківський рахунок DNTrade') {
    if (!isRecord(raw.organization) || !isRecord(raw.account)) return { kind: 'unsupported' }
    const fields = [
      ...sourceField('Організація', raw.organization.name),
      ...sourceField('Статус організації', raw.organization.status),
      ...sourceField('Назва рахунку', raw.account.label),
      ...sourceField('Номер рахунку', raw.account.number),
    ]
    return fields.length ? { kind: 'fields', groups: [{ fields }] } : { kind: 'empty' }
  }

  if (entityType === 'financialReport' && documentType === 'Журнал коригувань заборгованості') {
    const { visibleTotal } = raw
    if (typeof visibleTotal !== 'number' || !Number.isSafeInteger(visibleTotal) || visibleTotal < 0) return { kind: 'unsupported' }
    return { kind: 'fields', groups: [{ fields: [{ label: 'Видимих записів у джерелі', value: String(visibleTotal) }] }] }
  }

  if (entityType !== 'financialReport' || documentType !== 'Облікові параметри організацій') return { kind: 'empty' }
  if (!Array.isArray(raw.organizations) || raw.organizations.length > 50) return { kind: 'unsupported' }
  const groups: ReportFieldGroup[] = []
  for (const entry of raw.organizations) {
    if (!isRecord(entry) || !isRecord(entry.organization) || !isSourceText(entry.organization.name) ||
        !Array.isArray(entry.taxFields) || entry.taxFields.length > 50) return { kind: 'unsupported' }

    const fields = sourceField('Статус організації', entry.organization.status)
    for (const field of entry.taxFields) {
      if (!isRecord(field) || !isSourceText(field.label) || !isSourceText(field.value)) return { kind: 'unsupported' }
      fields.push({ label: field.label, value: field.value })
    }
    groups.push({ title: entry.organization.name, fields })
  }
  return groups.length ? { kind: 'fields', groups } : { kind: 'empty' }
}

function parseRow(values: unknown[]): ReportRow | null {
  const row: ReportRow = []
  let columns = 0
  for (const cell of values) {
    if (!isRecord(cell)) return null
    const { value, colspan, rowspan } = cell
    if (!isSourceText(value) || !isSpan(colspan, maxColumns) || !isSpan(rowspan, maxRows)) {
      return null
    }

    columns += colspan
    if (columns > maxColumns) return null
    row.push({ value, colspan, rowspan })
  }
  return row
}

export function parseFinancialReportPreview(original: unknown): FinancialReportPreview {
  if (!isRecord(original) || !isRecord(original.raw)) return { kind: 'unsupported' }
  const raw = original.raw
  const sourceTables = raw.tables
  if (sourceTables == null) return parseStructuredReport(original.entityType, original.documentType, raw)
  if (!Array.isArray(sourceTables)) return { kind: 'unsupported' }

  const tables: ReportTable[] = []
  let rows = 0
  let cells = 0
  let limited = false

  for (const sourceTable of sourceTables.slice(0, maxTables)) {
    if (!Array.isArray(sourceTable)) return { kind: 'unsupported' }
    const table: ReportTable = { THEAD: [], TBODY: [], TFOOT: [] }
    for (const sourceRow of sourceTable) {
      if (!isRecord(sourceRow) || !Array.isArray(sourceRow.cells)) return { kind: 'unsupported' }
      const { section } = sourceRow
      if (section !== 'THEAD' && section !== 'TBODY' && section !== 'TFOOT') return { kind: 'unsupported' }
      if (rows === maxRows || cells + sourceRow.cells.length > maxCells) {
        limited = true
        break
      }

      const row = parseRow(sourceRow.cells)
      if (!row) return { kind: 'unsupported' }
      table[section].push(row)
      rows += 1
      cells += row.length
    }

    if (Object.values(table).some((group) => group.some((row) => row.length > 0))) tables.push(table)
    if (limited) break
  }

  limited ||= sourceTables.length > maxTables
  if (tables.length === 0) return { kind: limited ? 'unsupported' : 'empty' }
  return { kind: 'tables', tables, limited, fields: reportScope(raw) }
}
