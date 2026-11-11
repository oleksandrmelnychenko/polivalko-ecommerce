import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getHome } from '../api/siteApi'
import { HomeSettingsForm } from '../components/HomeSettingsForm'
import '@/shared/ui/split/split.css'
import './site.css'

export function HomeSettingsPage() {
  const home = useApiQuery('site-home', () => getHome())

  if (home.status === 'ready' && home.data) return <HomeSettingsForm initial={home.data} onSaved={home.setData} />

  return (
    <>
      <PageHeader title="Головна" />
      {home.status === 'error' || home.status === 'forbidden' ? (
        <PageState
          kind={home.status}
          description={problemMessage(home.problem, 'Спробуйте ще раз. Якщо помилка повториться, повідомте розробника.')}
          onRetry={home.status === 'error' ? home.reload : undefined}
        />
      ) : (
        <PageState kind="loading" />
      )}
    </>
  )
}
