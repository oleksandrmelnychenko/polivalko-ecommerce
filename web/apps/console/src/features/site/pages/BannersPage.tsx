import { Button, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { ListPage, ListPageBody } from '@/shared/ui/ListPage'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { deleteBanner, getBanners, reorderBanners, type Banner } from '../api/siteApi'
import { BannerDrawer } from '../components/BannerDrawer'
import { bannersColumns } from '../components/bannersColumns'
import { ListError } from '../components/ListError'
import { SiteToolbar } from '../components/SiteToolbar'
import { moveItem } from '../lib/homeSettings'
import { periodLabel, periodState } from '../lib/period'
import './site.css'

const getRowId = (row: Banner) => row.id

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
  const positions = useMemo(() => new Map(rows.map((row, index) => [row.id, index])), [rows])
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

  const columns = useMemo(
    () =>
      bannersColumns({
        count: rows.length,
        indexOf: (id) => positions.get(id) ?? 0,
        busy: ordering,
        onMove: (index, delta) => void move(index, delta),
        onDelete: setRemoving,
      }),
    [rows.length, positions, ordering, move],
  )

  const openBanner = useCallback((banner: Banner) => setEditing((current) => ({ banner, opened: true, seq: current.seq + 1 })), [])

  function openNew() {
    setEditing((current) => ({ banner: null, opened: true, seq: current.seq + 1 }))
  }

  function onSaved(banner: Banner, created: boolean) {
    const next = created ? [...rows, banner] : rows.map((row) => (row.id === banner.id ? banner : row))
    setData(next)
    setEditing((current) => ({ ...current, banner, opened: false }))
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
    <ListPage>
      <PageHeader
        title="Банери"
        actions={
          <Button leftSection={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>
            Новий банер
          </Button>
        }
      />
      <SiteToolbar
        note="Слайди першого екрана головної. Сайт показує активні банери в межах дат показу, у цьому порядку."
        summary={banners.data ? `Показується: ${live} з ${rows.length}` : null}
        isLoading={banners.isFetching}
        onRefresh={reload}
      />
      <ListPageBody>
        <DataTable
          ariaLabel="Банери"
          columns={columns}
          data={rows}
          getRowId={getRowId}
          isLoading={banners.isLoading}
          isFetching={banners.isFetching}
          minWidth={1060}
          height="100%"
          onRowClick={openBanner}
          emptyText={failed ? <ListError problem={banners.problem} onRetry={reload} /> : 'Банерів ще немає. Додайте перший, і слайдер з’явиться на головній.'}
        />
      </ListPageBody>
      <BannerDrawer editing={editing} onClose={() => setEditing((current) => ({ ...current, opened: false }))} onSaved={onSaved} />
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
        confirmLabel="Видалити"
        danger
        busy={removeBusy}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </ListPage>
  )
}
