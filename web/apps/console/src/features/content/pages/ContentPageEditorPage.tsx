import { useParams } from 'react-router-dom'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getPage } from '../api/contentApi'
import { PageEditor } from '../components/PageEditor'
import { PageEditorHeading } from '../components/PageEditorHeading'
import './content.css'

export function ContentPageEditorPage() {
  const { slug = '' } = useParams()
  const page = useApiQuery(`content-page:${slug}`, () => getPage(slug))
  const current = page.data?.slug === slug ? page.data : undefined

  if (current && page.status === 'ready') return <PageEditor key={current.slug} initial={current} onSaved={page.setData} />

  return (
    <>
      <PageHeader title={slug} heading={<PageEditorHeading title={slug} />} />
      {page.status === 'error' || page.status === 'forbidden' ? (
        <PageState
          kind={page.status}
          description={problemMessage(page.problem, 'Спробуйте ще раз. Якщо помилка повториться, повідомте розробника.')}
          onRetry={page.status === 'error' ? page.reload : undefined}
        />
      ) : (
        <PageState kind="loading" />
      )}
    </>
  )
}
