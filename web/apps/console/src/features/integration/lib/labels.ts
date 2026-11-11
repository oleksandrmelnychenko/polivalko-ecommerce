import { formatDateTime, plural } from '@polivalko/shared/lib/format'
import type { TableChipTone } from '@/shared/ui/TableChip'
import type { SyncJob, SyncRunStatus } from '../api/integrationApi'

export const navkoloModeLabel: Record<string, string> = {
  Disabled: 'вимкнено: ціни й залишки приходять з імпорту файлів',
  DNTrade: 'API Навколо.Торгівля',
  Stub: 'тестова заглушка: обмін з Navkolo імітується',
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
  'ordering.cancellation-requested.v1': 'Скасування замовлення в Навколо',
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

export const jobDescription: Record<string, string> = {
  'navkolo.price-stock':
    'Забирає з Navkolo ціни й залишки, звіряє скасування й відвантаження замовлень. Від нього залежить онлайн-оплата: коли дані застаріли, замовлення йдуть як заявки.',
  'navkolo.catalog': 'Завантажує з Navkolo товари й категорії. Фото, описи й SEO сайту не перезаписує.',
  'navkolo.import': 'Імпорт каталогу з файлу вивантаження Navkolo. Запускається, коли ви завантажуєте файл.',
  'novaposhta.directory': 'Оновлює довідник міст і відділень Нової пошти, з якого покупець обирає доставку.',
  'payments.reconcile': 'Перепитує в платіжного провайдера стан незавершених оплат і підхоплює повідомлення, що загубилися.',
}

export const NOVA_POSHTA_JOB = 'novaposhta.directory'

export type JobState = { label: string; tone: TableChipTone }

export function jobState(job: SyncJob): JobState {
  if (waitsForWorker(job)) return { label: 'Чекає запуску', tone: 'source' }
  if (job.consecutiveFailures > 0)
    return { label: job.consecutiveFailures === 1 ? 'Збій' : `${job.consecutiveFailures} ${plural(job.consecutiveFailures, 'збій', 'збої', 'збоїв')} поспіль`, tone: 'danger' }
  if (!job.lastAttemptAt) return { label: 'Ще не запускалось', tone: 'neutral' }
  return { label: 'Успішно', tone: 'success' }
}

export function duration(start: string, end: string | null): string | null {
  if (!end) return null
  const ms = Math.max(0, Date.parse(end) - Date.parse(start))
  if (ms < 1000) return 'менше секунди'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} с`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} хв ${seconds % 60} с`
  return `${Math.floor(minutes / 60)} год ${minutes % 60} хв`
}
