import { Alert } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import type { IntegrationStatus } from '../api/integrationApi'
import { navkoloModeLabel } from '../lib/labels'

export function IntegrationSummary({ status }: { status: IntegrationStatus }) {
  return (
    <div className="integration-head">
      {!status.catalogDataFresh ? (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} title="Ціни й залишки застаріли" role="status" className="integration-stale">
          Сайт приймає нові замовлення як заявки без онлайн-оплати й без резерву: менеджер підтверджує ціну й наявність вручну. Онлайн-оплата повернеться
          після вдалої синхронізації цін і залишків з Navkolo.
        </Alert>
      ) : null}
      <dl className="integration-facts">
        <div className="integration-fact">
          <dt>Режим Navkolo</dt>
          <dd>{navkoloModeLabel[status.navkoloMode] ?? status.navkoloMode}</dd>
        </div>
        <div className="integration-fact">
          <dt>Ціни й залишки</dt>
          <dd>
            {status.catalogDataFresh ? (
              <span className="integration-good">актуальні, онлайн-оплата доступна</span>
            ) : (
              <span className="integration-bad">застарілі, замовлення йдуть як заявки</span>
            )}
          </dd>
        </div>
        <div className="integration-fact">
          <dt>Черга операцій</dt>
          <dd>
            {status.outboxPending} чекають виконання,{' '}
            {status.outboxFailed > 0 ? <span className="integration-bad">{status.outboxFailed} не виконано</span> : 'невиконаних немає'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
