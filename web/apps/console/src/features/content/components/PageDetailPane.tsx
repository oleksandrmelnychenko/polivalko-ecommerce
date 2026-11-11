import { ActionIcon, Button, Skeleton, Tooltip } from '@mantine/core'
import { IconExternalLink, IconFileText, IconPencil } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { formatDateTime, plural } from '@polivalko/shared/lib/format'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { siteUrl } from '@/shared/lib/siteUrl'
import { moment } from '@/shared/lib/when'
import { getPage, type PageListItem } from '../api/contentApi'
import { pageEditorHref } from '../lib/contentLinks'
import { previewDocument } from '../lib/previewDocument'
import { ListError } from './ListError'

const SHOP_SUFFIX = ' | Poli Valko'
const countFormat = new Intl.NumberFormat('uk-UA')

function wordCount(html: string | null | undefined): number {
  if (!html) return 0
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')
  return text.split(/\s+/).filter((word) => /\p{L}|\p{N}/u.test(word)).length
}

export function PageDetailPane({ item }: { item: PageListItem | null }) {
  if (!item) return <section className="app-split-detail app-split-detail-empty">Оберіть сторінку зліва.</section>
  return <PageDetail key={item.slug} item={item} />
}

function PageDetail({ item }: { item: PageListItem }) {
  const page = useApiQuery(`content-page:${item.slug}:${item.updatedAt}`, () => getPage(item.slug))
  const data = page.data
  const updated = moment(item.updatedAt)
  const words = wordCount(data?.bodyHtml)
  const seoTitle = `${item.seoTitle?.trim() || item.title}${SHOP_SUFFIX}`
  const seoDescription = item.seoDescription?.trim() || data?.lead?.trim()

  return (
    <section className="app-split-detail" aria-labelledby="content-page-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <span className="content-page-icon" aria-hidden="true">
              <IconFileText size={28} stroke={1.5} />
            </span>
            <div className="app-split-hero-main">
              <p className="app-split-hero-kicker app-split-mono">/{item.slug}</p>
              <h2 id="content-page-title">{item.title}</h2>
              {data?.lead ? <p className="app-split-description">{data.lead}</p> : null}
            </div>
          </div>
          <div className="app-split-actions">
            <Button component={Link} to={pageEditorHref(item.slug)} leftSection={<IconPencil size={16} stroke={1.7} />}>
              Редагувати
            </Button>
            <Tooltip label="Сторінка на сайті">
              <ActionIcon component="a" href={siteUrl(`/${item.slug}`)} target="_blank" rel="noopener" variant="subtle" color="gray" size="lg" aria-label={`Відкрити «${item.title}» на сайті`}>
                <IconExternalLink size={17} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
        <dl className="app-split-stats is-text">
          <div>
            <dt>Оновлено</dt>
            <dd title={formatDateTime(item.updatedAt)}>
              {updated.day} о {updated.time}
            </dd>
          </div>
          <div>
            <dt>Хто змінив</dt>
            <dd>{item.updatedBy ?? <span className="app-split-value-empty">невідомо</span>}</dd>
          </div>
          <div>
            <dt>Обсяг тексту</dt>
            <dd>{data ? `${countFormat.format(words)} ${plural(words, 'слово', 'слова', 'слів')}` : '…'}</dd>
          </div>
        </dl>
      </header>

      <section className="app-split-card" aria-labelledby="content-page-seo">
        <header className="app-split-card-head">
          <h3 id="content-page-seo">Як виглядає в пошуку</h3>
          <span>{item.seoDescription?.trim() ? 'власні SEO-поля' : item.seoTitle?.trim() ? 'власний SEO-заголовок' : 'з заголовка й підзаголовка'}</span>
        </header>
        <figure className="content-snippet" aria-label="Приблизний вигляд у пошуку Google">
          <span className="content-snippet-site">Poli Valko</span>
          <span className="content-snippet-url">{siteUrl(`/${item.slug}`)}</span>
          <span className="content-snippet-title">{seoTitle}</span>
          <span className="content-snippet-description">{seoDescription || 'Опису немає: Google візьме уривок тексту зі сторінки.'}</span>
        </figure>
      </section>

      <section className="app-split-card" aria-labelledby="content-page-text">
        <header className="app-split-card-head">
          <h3 id="content-page-text">Текст на сайті</h3>
          <span>збережена версія</span>
        </header>
        {page.isLoading ? (
          <Skeleton height={320} radius={10} />
        ) : page.status === 'error' || page.status === 'forbidden' ? (
          <ListError problem={page.problem} onRetry={page.reload} />
        ) : data?.bodyHtml ? (
          <iframe className="content-detail-frame" title={`Текст сторінки «${item.title}»`} sandbox="" srcDoc={previewDocument(data.bodyHtml)} />
        ) : (
          <p className="app-split-blank">Текст сторінки порожній.</p>
        )}
      </section>
    </section>
  )
}
