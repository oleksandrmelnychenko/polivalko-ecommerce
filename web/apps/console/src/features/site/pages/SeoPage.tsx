import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { ListPage } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { ScreenTabs, type ScreenTab } from '@/shared/ui/ScreenTabs'
import { RedirectsPanel } from '../components/RedirectsPanel'
import { SeoTemplatesPanel } from '../components/SeoTemplatesPanel'
import './site.css'

type SeoTab = 'redirects' | 'templates'

export function SeoPage() {
  const { can } = usePermissions()
  const [params, setParams] = useSearchParams()
  const tabs: ScreenTab<SeoTab>[] = [
    ...(can(PermissionKeys.Catalog.ManageRedirects) ? [{ value: 'redirects' as const, label: 'Перенаправлення' }] : []),
    ...(can(PermissionKeys.Site.ManageSeo) ? [{ value: 'templates' as const, label: 'Мета-шаблони' }] : []),
  ]
  const requested = params.get('tab')
  const tab = tabs.find((item) => item.value === requested)?.value ?? tabs[0]?.value

  function selectTab(next: SeoTab) {
    setParams(
      (current) => {
        const query = new URLSearchParams(current)
        query.set('tab', next)
        return query
      },
      { replace: true },
    )
  }

  if (!tab) {
    return (
      <>
        <PageHeader title="SEO" />
        <PageState kind="forbidden" description="Потрібне право «Перенаправлення адрес (SEO)» або «SEO: мета-шаблони»." />
      </>
    )
  }

  return (
    <ListPage>
      <ScreenTabs tabs={tabs} value={tab} label="Розділи SEO" onChange={selectTab} />
      {tab === 'redirects' ? <RedirectsPanel /> : <SeoTemplatesPanel />}
    </ListPage>
  )
}
