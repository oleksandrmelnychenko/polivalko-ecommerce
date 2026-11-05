import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import type { DashboardSummary } from '../api/dashboardApi'

export function HealthAlerts({ summary, canOpen }: { summary: DashboardSummary; canOpen: boolean }) {
  const issues = [
    !summary.catalogDataFresh &&
      `Ціни й залишки не оновлювалися${summary.lastPriceSync ? ` з ${formatDateTime(summary.lastPriceSync)}` : ''}: нові замовлення приймаються як заявки без онлайн-оплати.`,
    summary.failedOperations > 0 && `Невиконаних фонових операцій: ${summary.failedOperations}.`,
    summary.pendingRefunds > 0 && `Повернень коштів в обробці: ${summary.pendingRefunds}.`,
  ].filter((issue): issue is string => Boolean(issue))

  return (
    <div className="dash-alerts" role="status">
      {issues.length === 0 ? (
        <p className="dash-alert is-ok">
          <IconCircleCheck size={18} stroke={1.8} aria-hidden="true" />
          <span>Інтеграції в нормі{summary.lastPriceSync ? `, ціни оновлено ${formatDateTime(summary.lastPriceSync)}` : ''}.</span>
          {canOpen ? (
            <Link to="/system/integrations" className="dash-link">
              Інтеграції
            </Link>
          ) : null}
        </p>
      ) : (
        issues.map((issue) => (
          <p key={issue} className="dash-alert">
            <IconAlertTriangle size={18} stroke={1.8} aria-hidden="true" />
            <span>{issue}</span>
            {canOpen ? (
              <Link to="/system/integrations" className="dash-link">
                Розібратися
              </Link>
            ) : null}
          </p>
        ))
      )}
    </div>
  )
}
