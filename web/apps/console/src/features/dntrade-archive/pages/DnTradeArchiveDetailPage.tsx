import { Button } from '@mantine/core'
import { IconChevronLeft, IconDownload } from '@tabler/icons-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { archiveOriginalHref, getArchiveDetail } from '../api/archiveApi'
import { ARCHIVE_PATH, archiveAmount, archiveEntityLabel, archiveSourceDate } from '../lib/archive'
import '@/shared/ui/split/split.css'
import './dntrade-archive-detail.css'

const importedAtFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kyiv' })

export function DnTradeArchiveDetailPage() {
  const { can } = usePermissions()
  const { id = '' } = useParams()
  const { search } = useLocation()
  const document = useApiQuery(`dntrade-archive-detail:${id}`, () => getArchiveDetail(id))
  const item = document.status === 'ready' ? document.data : undefined
  const notFound = document.problem?.code === 'dntrade.archive_not_found'

  return (
    <ListPage>
      <PageHeader
        title={item ? `Архів Навколо · ${item.sourceId}` : 'Архів Навколо'}
        actions={
          <>
            <Button component={Link} to={{ pathname: ARCHIVE_PATH, search }} variant="default" leftSection={<IconChevronLeft size={16} stroke={1.8} />}>
              До архіву
            </Button>
            {item && can(PermissionKeys.DnTradeArchive.Original) ? (
              <Button component="a" href={archiveOriginalHref(item.id)} download variant="default" leftSection={<IconDownload size={16} stroke={1.8} />}>
                Завантажити оригінал
              </Button>
            ) : null}
          </>
        }
      />
      <ListPageBody>
        {item ? (
          <article className="app-split-detail dntrade-archive-detail" aria-labelledby="archive-item-title">
            <header className="app-split-hero">
              <div className="app-split-hero-top">
                <div className="app-split-hero-main">
                  <p className="app-split-hero-kicker">{archiveEntityLabel(item.entityType)}</p>
                  <h2 id="archive-item-title">{item.sourceId}</h2>
                </div>
              </div>
              <dl className="app-split-stats">
                <div>
                  <dt>Дата запису</dt>
                  <dd>{item.sourceDate ? <time dateTime={item.sourceDate}>{archiveSourceDate(item.sourceDate, true)}</time> : '—'}</dd>
                </div>
                <div>
                  <dt>Статус у джерелі</dt>
                  <dd>{item.status ?? '—'}</dd>
                </div>
                <div>
                  <dt>Сума в джерелі</dt>
                  <dd>{archiveAmount(item.total, item.currency)}</dd>
                </div>
              </dl>
            </header>
            <section className="app-split-card" aria-labelledby="archive-source-title">
              <header className="app-split-card-head">
                <h3 id="archive-source-title">Реквізити джерела</h3>
              </header>
              <dl className="app-split-fields">
                <div>
                  <dt>Код джерела</dt>
                  <dd>{item.sourceAccount}</dd>
                </div>
                <div>
                  <dt>Вид документа</dt>
                  <dd>{item.documentType ?? '—'}</dd>
                </div>
                <div>
                  <dt>Код організації</dt>
                  <dd>{item.organizationId ?? '—'}</dd>
                </div>
                <div>
                  <dt>Коди складів</dt>
                  <dd>{item.storeIds.join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt>Код батьківського запису</dt>
                  <dd>{item.parentSourceId ?? '—'}</dd>
                </div>
                <div>
                  <dt>Імпортовано</dt>
                  <dd>{importedAtFormat.format(new Date(item.importedAt))}</dd>
                </div>
              </dl>
            </section>
          </article>
        ) : document.status === 'loading' ? (
          <PageState kind="loading" />
        ) : (
          <PageState
            kind={notFound ? 'empty' : document.status === 'forbidden' ? 'forbidden' : 'error'}
            title={notFound ? document.problem?.title : undefined}
            description={notFound ? undefined : problemMessage(document.problem, 'Не вдалося відкрити запис архіву.')}
            onRetry={!notFound && document.status === 'error' ? document.reload : undefined}
          />
        )}
      </ListPageBody>
    </ListPage>
  )
}
