import { Button } from '@mantine/core'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { readBusiness } from '../api/businessAnalytics'

type Years = { invoices: number[]; markets: number[] }

export function ReportYears({ report, children }: {
  report: keyof Years
  children: (year: number, years: number[]) => ReactNode
}) {
  const [params] = useSearchParams()
  const query = useApiQuery('business-sales-years', () => readBusiness<Years>('documents', 'analysis=years'))
  const years = query.data?.[report]
  if (query.status === 'error' || query.status === 'forbidden' || (query.data && !Array.isArray(years))) {
    return <p role="alert">{query.problem?.title ?? 'Не вдалося завантажити роки продажів.'}{' '}
      <Button size="xs" variant="default" onClick={query.reload}>Повторити</Button></p>
  }
  if (!years) return <p role="status">Завантажуємо роки продажів…</p>
  if (!years.length) return <p role="status">{report === 'invoices'
    ? 'Ще немає проведених документів продажу.' : 'Ще немає років із продажами.'}</p>
  const requested = Number(params.get('year'))
  return children(years.includes(requested) ? requested : years[0], years)
}
