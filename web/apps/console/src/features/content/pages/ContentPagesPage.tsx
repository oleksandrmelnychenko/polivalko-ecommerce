import { IconFileText, IconHeading, IconListDetails } from '@tabler/icons-react'
import { SiteMetrics } from '@/shared/ui/site/SiteMetrics'
import { SiteRecordWorkspace } from '@/shared/ui/site/SiteRecordWorkspace'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PageHeader } from '@/shared/ui/PageHeader'
import { shortWhen } from '@/shared/lib/when'
import { getPages } from '../api/contentApi'
import { ListError } from '../components/ListError'
import { PageDetailPane } from '../components/PageDetailPane'
import './content.css'

export function ContentPagesPage() {
  const pages = useApiQuery('content-pages', () => getPages())
  const failed = pages.status === 'error' || pages.status === 'forbidden'
  const items = failed ? [] : pages.data ?? []

  return (
    <>
      <PageHeader title="Сторінки" />
      {pages.status === 'ready' && <SiteMetrics label="Наповнення сторінок" metrics={[
        { label: 'Текстові сторінки', icon: IconFileText, count: items.length },
        { label: 'Власний SEO-заголовок', icon: IconHeading, count: items.filter(page => page.seoTitle?.trim()).length, total: items.length },
        { label: 'Власний SEO-опис', icon: IconListDetails, count: items.filter(page => page.seoDescription?.trim()).length, total: items.length },
      ]} />}
      <SiteRecordWorkspace
        title="Текстові сторінки" parameter="page" refresh={pages.reload} refreshing={pages.isFetching} loading={pages.isLoading}
        empty={failed ? <ListError problem={pages.problem} onRetry={pages.reload} /> : 'Текстових сторінок ще немає.'}
        rows={items.map(page => ({
          id: page.slug, name: page.title, icon: <IconFileText size={16} />,
          detail: <>/{page.slug} · {shortWhen(page.updatedAt)}</>,
          sortValues: { title: page.title, updatedAt: Date.parse(page.updatedAt) },
        }))}
        sortOptions={[{ key: 'title', label: 'Назва' }, { key: 'updatedAt', label: 'Дата оновлення', descending: true }]}
      >
        {slug => <PageDetailPane item={items.find(page => page.slug === slug) ?? null} />}
      </SiteRecordWorkspace>
    </>
  )
}
