import { useCallback, useState } from 'react'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getDeliverySettings, getPickupPoints, type PickupPoint } from '../api/settingsApi'
import { DeliverySettingsForm } from '../components/DeliverySettingsForm'
import { PickupPointDrawer } from '../components/PickupPointDrawer'
import './settings.css'

export function DeliverySettingsPage() {
  const delivery = useApiQuery('settings-delivery', () => getDeliverySettings())
  const points = useApiQuery('settings-pickup-points', () => getPickupPoints())
  const [editing, setEditing] = useState<{ point: PickupPoint | null; opened: boolean }>({ point: null, opened: false })
  const editPoint = useCallback((point: PickupPoint) => setEditing({ point, opened: true }), [])

  function onPointSaved(point: PickupPoint) {
    points.setData((points.data ?? []).map((item) => (item.code === point.code ? point : item)))
    setEditing({ point, opened: false })
  }

  return (
    <>
      {delivery.status === 'ready' && delivery.data ? (
        <DeliverySettingsForm initial={delivery.data} points={points} onSaved={delivery.setData} onEditPoint={editPoint} />
      ) : (
        <>
          <PageHeader title="Доставка" />
          {delivery.status === 'error' || delivery.status === 'forbidden' ? (
            <PageState
              kind={delivery.status}
              description={problemMessage(delivery.problem, 'Перевірте, що API працює, і спробуйте ще раз.')}
              onRetry={delivery.status === 'error' ? delivery.reload : undefined}
            />
          ) : (
            <PageState kind="loading" />
          )}
        </>
      )}
      <PickupPointDrawer
        point={editing.point}
        opened={editing.opened}
        onClose={() => setEditing((current) => ({ ...current, opened: false }))}
        onSaved={onPointSaved}
      />
    </>
  )
}
