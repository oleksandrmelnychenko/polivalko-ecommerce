type SourceRecord = { sourceId: string; entityType: string }

export type OpeningBalanceChoice = {
  value: string
  label: string
  organization: string
  account: string
  currency: string
  amount: string
}

const EXACT_AMOUNT = /^-?\d{1,12}(?:\.\d{1,2})?$/
const CURRENCY = /^[A-Z]{3}$/

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !/[\u0000-\u001f]/.test(value)
}

export function openingBalanceChoices(detail: SourceRecord, original: unknown): OpeningBalanceChoice[] {
  if (!record(original) || original.schemaVersion !== 1 || original.source !== 'dntrade' ||
    original.entityType !== 'financialReport' || original.entityType !== detail.entityType || original.sourceId !== detail.sourceId ||
    !record(original.raw) || !Array.isArray(original.raw.openingBalanceRows)) return []

  const choices = new Map<string, OpeningBalanceChoice>()
  for (const row of original.raw.openingBalanceRows) {
    if (!record(row) || row.state !== 'reconciledToSource' ||
      (row.sourceEntityType !== 'bankAccount' && row.sourceEntityType !== 'cashbox') ||
      !text(row.sourceEntityId) || !text(row.organizationName) ||
      typeof row.currency !== 'string' || !CURRENCY.test(row.currency) ||
      typeof row.closingBalance !== 'string' || !EXACT_AMOUNT.test(row.closingBalance)) continue

    const value = `${row.sourceEntityType}:${row.sourceEntityId}`
    if (choices.has(value)) return []
    const kind = row.sourceEntityType === 'bankAccount' ? 'Рахунок' : 'Каса'
    choices.set(value, {
      value,
      label: `${row.organizationName} · ${kind} ${row.sourceEntityId.slice(-8)}`,
      organization: row.organizationName,
      account: row.sourceEntityId,
      currency: row.currency,
      amount: row.closingBalance,
    })
  }
  return [...choices.values()]
}
