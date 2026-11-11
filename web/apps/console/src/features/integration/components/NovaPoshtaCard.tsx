import { Skeleton } from '@mantine/core'
import type { ApiQuery } from '@/shared/api/useApiQuery'
import type { NovaPoshtaStatus } from '../api/integrationApi'
import { countFormat, novaPoshtaModeLabel } from '../lib/labels'
import { ListError } from './ListError'

export function NovaPoshtaCard({ np }: { np: ApiQuery<NovaPoshtaStatus> }) {
  const data = np.data
  const failed = np.status === 'error' || np.status === 'forbidden'

  return (
    <section className="app-split-card" aria-labelledby="integration-np-title">
      <header className="app-split-card-head">
        <h3 id="integration-np-title">Довідник на сайті</h3>
      </header>
      {data ? (
        <>
          <dl className="integration-np-stats" data-fetching={np.isFetching || undefined}>
            <div>
              <dt>Населених пунктів</dt>
              <dd>{countFormat.format(data.settlements)}</dd>
            </div>
            <div>
              <dt>Відділень і поштоматів</dt>
              <dd>{countFormat.format(data.warehouses)}</dd>
            </div>
            <div>
              <dt>З них поштоматів</dt>
              <dd>{countFormat.format(data.postomats)}</dd>
            </div>
          </dl>
          <p className="integration-card-note">Режим: {novaPoshtaModeLabel[data.mode] ?? data.mode}.</p>
        </>
      ) : failed ? (
        <ListError problem={np.problem} onRetry={np.reload} />
      ) : (
        <Skeleton height={64} radius={10} />
      )}
    </section>
  )
}
