import type { ReactNode } from 'react'
import type { ApiQuery } from '@/shared/api/useApiQuery'
import { PageState } from '@/shared/ui/PageState'
import { problemMessage } from '@/shared/api/problem'
import type { NovaPoshtaStatus } from '../api/integrationApi'
import { countFormat, novaPoshtaModeLabel, when } from '../lib/labels'
import type { ShowDetail } from './DetailModal'
import { ErrorText, Failures } from './ErrorText'

export function NovaPoshtaPanel({ np, onExpand }: { np: ApiQuery<NovaPoshtaStatus>; onExpand: ShowDetail }) {
  const data = np.data
  if (!data) {
    if (np.status === 'error' || np.status === 'forbidden')
      return <PageState kind={np.status} description={problemMessage(np.problem, 'Перевірте, що API працює, і спробуйте ще раз.')} onRetry={np.reload} />
    return <PageState kind="loading" />
  }

  const rows: [string, ReactNode][] = [
    ['Режим', novaPoshtaModeLabel[data.mode] ?? data.mode],
    ['Населених пунктів', <span className="app-number">{countFormat.format(data.settlements)}</span>],
    [
      'Відділень і поштоматів',
      <span className="app-number">
        {countFormat.format(data.warehouses)}, з них поштоматів {countFormat.format(data.postomats)}
      </span>,
    ],
    ['Остання спроба', when(data.sync.lastAttemptAt)],
    ['Останній успіх', when(data.sync.lastSuccessAt)],
    ['Збоїв поспіль', <Failures count={data.sync.consecutiveFailures} />],
    ['Остання помилка', <ErrorText text={data.sync.lastError} title="Нова пошта: остання помилка" onExpand={onExpand} />],
  ]

  return (
    <div className="integration-panel" data-fetching={np.isFetching || undefined}>
      <section className="integration-card" aria-labelledby="integration-np-title">
        <h2 id="integration-np-title" className="app-section-title">
          Нова пошта
        </h2>
        <dl className="integration-dl">
          {rows.map(([label, value]) => (
            <div key={label} className="integration-dl-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
