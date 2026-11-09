import { formatDateTime } from '@polivalko/shared/lib/format'
import type { TableChipTone } from '@/shared/ui/TableChip'
import type { SyncJob, SyncRunStatus } from '../api/integrationApi'

export const navkoloModeLabel: Record<string, string> = {
  Disabled: 'вимкнено: ціни й залишки приходять з імпорту файлів',
  Stub: 'тестова заглушка замість справжнього обміну з Navkolo',
}

export const FILE_IMPORT_JOB = 'navkolo.import'

export function waitsForWorker(job: SyncJob): boolean {
  return job.runRequestedAt !== null && (job.lastAttemptAt === null || Date.parse(job.runRequestedAt) > Date.parse(job.lastAttemptAt))
}

export const novaPoshtaModeLabel: Record<string, string> = {
  demo: 'демо: ключ API не налаштовано, вітрина показує демонстраційні відділення',
  api: 'API Нової пошти: вітрина бачить локальну копію довідника',
}

export const messageTypeLabel: Record<string, string> = {
  'ordering.order-placed': 'Сповіщення про нове замовлення',
  'ordering.export-requested': 'Передача замовлення в Navkolo',
  'ordering.payment-succeeded': 'Обробка успішної оплати',
  'ordering.refund-requested': 'Повернення коштів',
  'ordering.fiscal-receipt-requested': 'Фіскальний чек',
  'content.service-request-submitted': 'Сповіщення про заявку на послугу',
  'integration.alert': 'Сповіщення про збій інтеграції',
}

export const runStatusLabel: Record<SyncRunStatus, string> = {
  running: 'Виконується',
  succeeded: 'Успішно',
  partiallySucceeded: 'Частково, з помилками',
  failed: 'Не вдалося',
}

export const runStatusTone: Record<SyncRunStatus, TableChipTone> = {
  running: 'source',
  succeeded: 'success',
  partiallySucceeded: 'warning',
  failed: 'danger',
}

export function when(iso: string | null | undefined): string {
  return iso ? formatDateTime(iso) : 'немає'
}

export const countFormat = new Intl.NumberFormat('uk-UA')
