import { apiFetch } from '@/shared/api/client'
import { csrfHeader, forgetCsrf } from '@/shared/api/csrf'

export type Totals = {
  gross: number
  returns: number
  net: number
  profit: number | null
  coverage: number | null
  documents: number
}
export type Option = { value: string; label: string }
type Group = Totals & { id: string }
export type Paged<T> = { rows: T[]; total: number; page: number }
export type BusinessReport = {
  asOf: string
  start: string
  end: string
  summary: Omit<Totals, 'gross' | 'returns' | 'net'> & {
    gross: number | null
    returns: number | null
    net: number | null
  }
  previous: Totals | null
  months: { month: string; current: Totals | null; previous: Totals | null }[]
  heatmap: { category: string; months: (number | null)[]; years: number; indices: (number | null)[] }[]
  products: Paged<
    Group & { name: string; sku: string; unit: string; sold: number; returned: number; price: number | null }
  >
  contributions: { store: Group[]; category: Group[] }
  coverage: (Totals & { year: string; store: string; months: number; expected?: number; mismatches: number })[]
  diagnostics: Record<string, number>
  options: { org: Option[]; store: Option[]; category: Option[]; years: string[] }
}
export type Policy = {
  revision: number
  lead: number
  review: number
  safety: number
  confirmed: string
  deliveries: { day: string; qty: number }[]
}
export type Series = {
  kind: string
  org: string
  store: string
  product: string | null
  category: string
  name: string
  unit: string
  model: string | null
  reason: string | null
  wape: number | null
  baselineWape?: number | null
  bias: number | null
  folds: number
  seasonFolds?: number
  staleWeeks?: number
  history: (number | null)[]
  weeks: { value: number; low: number; high: number }[]
  stockoutWeeks: number
  policy?: Policy | null
  purchase?: {
    order: number | null
    available: number | null
    incoming: number | null
    stockout: string | null
    reason: string | null
  }
}
export type Projection = Paged<Series> & {
  asOf: string; start: string; version: string
  options: Pick<BusinessReport['options'], 'org' | 'store' | 'category'>
  coverage?: { ready: number; regression: number; intermittent: number }
}
export type DocumentRow = {
  id: string
  day: string
  origin: string
  number: string
  selected: number
  recorded: number | null
  difference: number | null
  invalid: number
}
export type Run = { state: string; updated: string | null; error: string | null; version: string; policiesWritable: boolean }

export { readBusiness } from '@/shared/api/readBusiness'

export async function writeBusiness(op: 'refresh' | 'policy', body?: object) {
  const send = async () =>
    apiFetch('/api/v1/console/business-analytics/' + op, {
      method: op === 'refresh' ? 'POST' : 'PUT',
      headers: { ...(await csrfHeader()), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  let response = await send()
  if (
    response.status === 400 &&
    (
      await response
        .clone()
        .json()
        .catch(() => null)
    )?.code === 'auth.csrf_invalid'
  ) {
    forgetCsrf()
    response = await send()
  }
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.title ?? 'Не вдалося виконати операцію')
}
