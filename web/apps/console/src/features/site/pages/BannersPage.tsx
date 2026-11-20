import { ActionIcon, Button, Loader, Text } from '@mantine/core'
import { IconArrowLeft, IconChevronRight, IconPlus, IconRefresh } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { deleteBanner, getBanners, reorderBanners, type Banner } from '../api/siteApi'
import { BannerDetailPane } from '../components/BannerDetailPane'
import { BannerEditorModal } from '../components/BannerEditorModal'
import { BannerStateChip } from '../components/BannerStateChip'
import { ListError } from '../components/ListError'
import { moveItem } from '../lib/homeSettings'
import { periodLabel, periodState } from '../lib/period'
import '@/shared/ui/split/split.css'
import './site.css'
import '@/shared/ui/site/site-home.css'
import './site-banners.css'

type Editing = { banner: Banner | null; opened: boolean; seq: number }

export function BannersPage() {
  const banners = useApiQuery('site-banners', () => getBanners())
  const { setData, reload } = banners
  const [editing, setEditing] = useState<Editing>({ banner: null, opened: false, seq: 0 })
  const [removing, setRemoving] = useState<Banner | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const failed = banners.status === 'error' || banners.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : [...(banners.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)), [failed, banners.data])
  const live = rows.filter((row) => periodState(row.isActive, row.startsAt, row.endsAt) === 'live').length

  const move = useCallback(
    async (index: number, delta: number) => {
      const ordered = moveItem(rows, index, delta).map((row, position) => ({ ...row, sortOrder: position }))
      if (ordered.every((row, position) => row.id === rows[position]?.id)) return
      setData(ordered)
      setOrdering(true)
      try {
        const result = await withCsrf((headers) =>
          reorderBanners(
            headers,
            ordered.map((row) => row.id),
          ),
        )
        if (!result.response.ok) {
          notifyError(problemMessage(result.error, 'Порядок не збережено.'))
          reload()
        } else if (Array.isArray(result.data)) {
          setData(result.data)
        }
      } catch {
        notifyError(NETWORK_ERROR)
        reload()
      }
      setOrdering(false)
    },
    [rows, setData, reload],
  )

  const [params, setParams] = useSearchParams()
  const pickedId = params.get('id')
  const selected = rows.find((row) => row.id === pickedId) ?? rows[0] ?? null
  const selectedId = selected?.id ?? null
  const selectBanner = useCallback(
    (banner: Banner | null) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (banner) next.set('id', banner.id)
          else next.delete('id')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const openBanner = useCallback((banner: Banner) => setEditing((current) => ({ banner, opened: true, seq: current.seq + 1 })), [])

  function openNew() {
    setEditing((current) => ({ banner: null, opened: true, seq: current.seq + 1 }))
  }

  function onSaved(banner: Banner, created: boolean) {
    const next = created ? [...rows, banner] : rows.map((row) => (row.id === banner.id ? banner : row))
    setData(next)
    setEditing((current) => ({ ...current, banner, opened: false }))
    selectBanner(banner)
    reload()
  }

  async function remove() {
    if (!removing) return
    const banner = removing
    setRemoveBusy(true)
    try {
      const result = await withCsrf((headers) => deleteBanner(headers, banner.id))
      if (result.response.ok) {
        notifySuccess('Банер видалено.')
        setData(rows.filter((row) => row.id !== banner.id))
        reload()
      } else {
        notifyError(problemMessage(result.error, 'Банер не видалено.'))
      }
    } catch {
      notifyError(NETWORK_ERROR)
    }
    setRemoveBusy(false)
    setRemoving(null)
  }

  return (
    <>
      <PageHeader
        title="Банери"
        actions={
          <Button leftSection={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>
            Новий банер
          </Button>
        }
      />
      <div className="home-workspace banner-workspace" data-editing={Boolean(pickedId && selectedId === pickedId) || undefined}>
        <section className="home-block-list" aria-labelledby="banner-list-title">
          <header>
            <div><h2 id="banner-list-title">Слайди головної</h2>
              {!failed && banners.data && <span className="banner-list-count">Показується <b>{live} / {rows.length}</b></span>}
            </div>
            <ActionIcon variant="subtle" color="gray" aria-label="Оновити банери" title="Оновити банери"
              loading={banners.isFetching} disabled={ordering} onClick={reload}><IconRefresh size={16} /></ActionIcon>
          </header>
          {failed ? <ListError problem={banners.problem} onRetry={reload} />
            : banners.isLoading ? <Loader size="sm" aria-label="Завантаження банерів" />
            : rows.length === 0 ? <p className="banner-empty">Банерів ще немає.</p> : (
              <ol>
                {rows.map(row => (
                  <li key={row.id}>
                    <button id={`banner-row-${row.id}`} type="button" className="home-block banner-row" aria-current={row.id === selectedId ? 'true' : undefined}
                      onClick={() => {
                        selectBanner(row)
                        requestAnimationFrame(() => { if (window.matchMedia('(max-width: 52em)').matches) document.getElementById('site-banner-title')?.focus() })
                      }}>
                      <img src={row.imageUrl} alt="" loading="lazy" className="banner-row-image" />
                      <span className="home-block-name"><strong>{row.title}</strong><BannerStateChip banner={row} /></span>
                      <IconChevronRight size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
          )}
        </section>
        {selected && <div className="home-block-editor">
          <Button className="home-back" variant="subtle" size="xs" color="gray" leftSection={<IconArrowLeft size={15} />}
            onClick={() => {
              selectBanner(null)
              requestAnimationFrame(() => document.getElementById(`banner-row-${selected.id}`)?.focus())
            }}>Усі банери</Button>
          <BannerDetailPane banner={selected} index={rows.indexOf(selected)} count={rows.length} busy={ordering || removeBusy}
            onEdit={openBanner} onDelete={setRemoving} onMove={(index, delta) => void move(index, delta)} />
        </div>}
      </div>
      <BannerEditorModal editing={editing} onClose={() => setEditing((current) => ({ ...current, opened: false }))} onSaved={onSaved} />
      <ConfirmDialog
        opened={removing !== null}
        title="Видалити банер"
        message={
          removing ? (
            <Text size="sm">
              Банер «{removing.title}» ({periodLabel(removing.startsAt, removing.endsAt).toLowerCase()}) зникне зі слайдера на головній. Скасувати видалення не можна.
            </Text>
          ) : (
            ''
          )
        }
        confirmLabel="Видалити банер"
        danger
        busy={removeBusy}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </>
  )
}
