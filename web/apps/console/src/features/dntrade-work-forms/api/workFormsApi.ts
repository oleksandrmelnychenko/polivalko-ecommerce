import { apiFetch } from '@/shared/api/client'
import { withCsrf } from '@/shared/api/csrf'
import type { ApiResult } from '@/shared/api/useApiQuery'
import { emptyWorkFormData, emptyWorkFormLine } from '../lib/workFormFields'
import type { WorkFormSection, WorkFormStatus, WorkFormType } from '../lib/workForms'

const WORK_FORMS_API = '/api/v1/console/dntrade-work-forms'

export type WorkFormLine = {
  sku: string | null
  description: string | null
  unit: string | null
  quantity: string | null
  expectedQuantity: string | null
  unitPrice: string | null
}

export type WorkFormData = {
  number: string | null
  organization: string | null
  counterparty: string | null
  warehouse: string | null
  destinationWarehouse: string | null
  account: string | null
  direction: 'in' | 'out' | null
  currency: string | null
  amount: string | null
  name: string | null
  code: string | null
  referenceKind: string | null
  phone: string | null
  email: string | null
  note: string | null
  lines: WorkFormLine[]
}

type WorkFormFields = {
  section: WorkFormSection
  type: WorkFormType
  status: WorkFormStatus
  title: string
  documentDate: string | null
  sourceRecordId: string | null
}

export type WorkFormListItem = WorkFormFields & {
  id: string
  version: number
  createdAt: string
  updatedAt: string
}

export type WorkFormRecord = WorkFormListItem & {
  data: WorkFormData
}

type WorkFormResponse = Omit<WorkFormRecord, 'data'> & {
  data: Partial<Omit<WorkFormData, 'lines'>> & { lines?: Partial<WorkFormLine>[] | null }
}

export type SaveWorkForm = WorkFormFields & {
  expectedVersion: number | null
  data: WorkFormData
}

export type WorkFormQuery = {
  q?: string
  status?: WorkFormStatus
  section?: WorkFormSection
  sourceRecordId?: string
  page: number
  pageSize: number
}

type WorkFormPage = {
  items: WorkFormListItem[]
  totalItems: number
  page: number
  pageSize: number
}

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await apiFetch(url, init)
  if (response.ok) return { data: await response.json() as T, response }
  return { error: await response.json().catch(() => undefined), response }
}

function normalize(result: ApiResult<WorkFormResponse>): ApiResult<WorkFormRecord> {
  if (!result.data) return { response: result.response, error: result.error }
  const record = result.data
  return {
    response: result.response,
    data: {
      ...record,
      data: {
        ...emptyWorkFormData(),
        ...record.data,
        lines: record.data.lines?.map((line) => ({ ...emptyWorkFormLine(), ...line })) ?? [],
      },
    },
  }
}

export function listWorkForms(query: WorkFormQuery) {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) })
  for (const key of ['q', 'status', 'section', 'sourceRecordId'] as const) {
    const value = query[key]
    if (value) params.set(key, value)
  }
  return request<WorkFormPage>(`${WORK_FORMS_API}?${params}`)
}

export function getWorkForm(id: string) {
  return request<WorkFormResponse>(`${WORK_FORMS_API}/${encodeURIComponent(id)}`).then(normalize)
}

export function saveWorkForm(id: string, input: SaveWorkForm) {
  return withCsrf((headers) => request<WorkFormResponse>(`${WORK_FORMS_API}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(input),
  })).then(normalize)
}
