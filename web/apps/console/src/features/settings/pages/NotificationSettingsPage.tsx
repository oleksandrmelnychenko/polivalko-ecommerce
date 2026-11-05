import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getNotificationSettings } from '../api/settingsApi'
import { NotificationSettingsForm } from '../components/NotificationSettingsForm'
import './settings.css'

export function NotificationSettingsPage() {
  const notifications = useApiQuery('settings-notifications', () => getNotificationSettings())

  if (notifications.status === 'ready' && notifications.data) return <NotificationSettingsForm initial={notifications.data} onSaved={notifications.setData} />

  return (
    <>
      <PageHeader title="Сповіщення" />
      {notifications.status === 'error' || notifications.status === 'forbidden' ? (
        <PageState
          kind={notifications.status}
          description={problemMessage(notifications.problem, 'Перевірте, що API працює, і спробуйте ще раз.')}
          onRetry={notifications.status === 'error' ? notifications.reload : undefined}
        />
      ) : (
        <PageState kind="loading" />
      )}
    </>
  )
}
