import { ActionIcon, Button, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconArrowRight, IconExternalLink, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react'
import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { siteUrl } from '@/shared/lib/siteUrl'
import { shortWhen } from '@/shared/lib/when'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { ListPageBody } from '@/shared/ui/ListPage'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableChip } from '@/shared/ui/TableChip'
import { createRedirect, deleteRedirect, getRedirects, type ConsoleRedirect } from '../api/siteApi'
import '@/shared/ui/split/split.css'

const getRowId = (row: ConsoleRedirect) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

const COLUMNS: DataTableColumn<ConsoleRedirect>[] = [
  {
    id: 'from',
    header: 'Адреси',
    width: 360,
    minWidth: 260,
    fill: true,
    cell: (row) => (
      <span className="app-split-row-text">
        <span className="site-redirect-from" title={row.fromPath}>
          {row.fromPath}
        </span>
        <span className="app-split-row-sub site-redirect-to" title={row.toPath}>
          → {row.toPath}
        </span>
      </span>
    ),
  },
  {
    id: 'kind',
    header: 'Як створено',
    width: 140,
    cell: (row) => <TableChip tone={row.isAutomatic ? 'neutral' : 'source'} value={row.isAutomatic ? 'Автоматично' : 'Вручну'} />,
  },
  {
    id: 'created',
    header: 'Коли',
    width: 170,
    cell: (row) => <span className="app-split-item-meta">{shortWhen(row.createdAt)}</span>,
  },
]

export function RedirectsPanel() {
  const redirects = useApiQuery('site-redirects', () => getRedirects())
  const [fromPath, setFromPath] = useState('')
  const [toPath, setToPath] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<ConsoleRedirect | null>(null)
  const [busy, setBusy] = useState(false)
  const failed = redirects.status === 'error' || redirects.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (redirects.data ?? [])), [failed, redirects.data])
  const [params, setParams] = useSearchParams()
  const picked = params.get('id')
  const selected = rows.find((row) => row.id === picked) ?? rows[0] ?? null
  const selectedId = selected?.id ?? null

  const select = useCallback(
    (row: ConsoleRedirect) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('id', row.id)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const rowClassName = useCallback((row: ConsoleRedirect) => (row.id === selectedId ? 'app-split-row-active' : undefined), [selectedId])

  async function create(event: FormEvent) {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    try {
      const result = await withCsrf((headers) => createRedirect(headers, { fromPath, toPath }))
      if (result.data) {
        setFromPath('')
        setToPath('')
        setErrors({})
        notifySuccess('Перенаправлення додано.')
        select(result.data)
        redirects.reload()
      } else {
        const byField = fieldErrors(result.error)
        setErrors(byField)
        if (!byField.fromPath && !byField.toPath) notifyError(problemMessage(result.error, 'Перенаправлення не додано.'))
      }
    } catch {
      notifyError(NETWORK_ERROR)
    }
    setCreating(false)
  }

  async function remove() {
    if (!removing) return
    const redirect = removing
    setBusy(true)
    try {
      const result = await withCsrf((headers) => deleteRedirect(headers, redirect.id))
      if (result.response.ok) {
        notifySuccess('Перенаправлення видалено.')
        redirects.reload()
      } else {
        notifyError(problemMessage(result.error, 'Перенаправлення не видалено.'))
      }
    } catch {
      notifyError(NETWORK_ERROR)
    }
    setBusy(false)
    setRemoving(null)
  }

  const emptyText = failed ? (
    <Stack align="center" gap={8}>
      <Text size="sm">{problemMessage(redirects.problem, 'Не вдалося завантажити перенаправлення.')}</Text>
      <Button size="xs" variant="default" onClick={redirects.reload}>
        Спробувати ще раз
      </Button>
    </Stack>
  ) : (
    'Перенаправлень ще немає. Сайт створює їх сам після зміни адреси товару чи категорії.'
  )

  return (
    <>
      <PageHeader title="Перенаправлення" />

      <ListPageBody>
        <div className="app-split-layout">
          <div className="app-split-list">
            <DataTable
              ariaLabel="Перенаправлення"
              columns={COLUMNS}
              data={rows}
              getRowId={getRowId}
              isLoading={redirects.isLoading}
              isFetching={redirects.isFetching}
              minWidth={560}
              height="100%"
              manualSorting
              onRowClick={select}
              rowClassName={rowClassName}
              emptyText={emptyText}
            />
          </div>
          <section className="app-split-detail" aria-label="Перенаправлення">
            <form className="app-split-card" noValidate onSubmit={create} aria-labelledby="site-redirect-new">
              <header className="app-split-card-head">
                <h3 id="site-redirect-new">Нове перенаправлення</h3>
                <span className="site-redirect-summary">
                  {redirects.data ? `усього ${countFormat.format(redirects.data.length)}` : null}
                  <Tooltip label="Оновити список">
                    <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Оновити список" loading={redirects.isFetching} onClick={redirects.reload}>
                      <IconRefresh size={14} />
                    </ActionIcon>
                  </Tooltip>
                </span>
              </header>
              <p className="app-split-blank">Стара адреса почне вести на нову. Адреси товарів і категорій сайт переносить сам, коли їх змінюють.</p>
              <div className="site-redirect-fields">
                <TextInput
                  label="Стара адреса"
                  placeholder="/product/stara-adresa"
                  required
                  value={fromPath}
                  spellCheck={false}
                  autoComplete="off"
                  error={errors.fromPath || undefined}
                  onChange={(event) => {
                    setFromPath(event.currentTarget.value)
                    setErrors((current) => ({ ...current, fromPath: '' }))
                  }}
                />
                <IconArrowRight className="site-redirect-arrow" size={18} stroke={1.7} aria-hidden="true" />
                <TextInput
                  label="Нова адреса"
                  placeholder="/product/nova-adresa"
                  required
                  value={toPath}
                  spellCheck={false}
                  autoComplete="off"
                  error={errors.toPath || undefined}
                  onChange={(event) => {
                    setToPath(event.currentTarget.value)
                    setErrors((current) => ({ ...current, toPath: '' }))
                  }}
                />
                <Button type="submit" className="site-redirect-submit" leftSection={<IconPlus size={16} stroke={1.8} />} loading={creating}>
                  Додати
                </Button>
              </div>
            </form>

            {selected ? (
              <section key={selected.id} className="app-split-card" aria-labelledby="site-redirect-detail">
                <header className="app-split-card-head">
                  <h3 id="site-redirect-detail">Обране перенаправлення</h3>
                  <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} stroke={1.7} />} onClick={() => setRemoving(selected)}>
                    Видалити
                  </Button>
                </header>
                <dl className="app-split-fields">
                  <div>
                    <dt>Стара адреса</dt>
                    <dd>
                      <a className="app-split-link site-redirect-path" href={siteUrl(selected.fromPath)} target="_blank" rel="noopener">
                        {selected.fromPath}
                        <IconExternalLink size={13} stroke={1.8} aria-hidden="true" />
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Веде на</dt>
                    <dd>
                      <a className="app-split-link site-redirect-path" href={siteUrl(selected.toPath)} target="_blank" rel="noopener">
                        {selected.toPath}
                        <IconExternalLink size={13} stroke={1.8} aria-hidden="true" />
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Як створено</dt>
                    <dd>{selected.isAutomatic ? 'Автоматично, після зміни адреси на сайті' : 'Вручну в консолі'}</dd>
                  </div>
                  <div>
                    <dt>Коли</dt>
                    <dd>{formatDateTime(selected.createdAt)}</dd>
                  </div>
                </dl>
              </section>
            ) : null}
          </section>
        </div>
      </ListPageBody>

      <ConfirmDialog
        opened={removing !== null}
        title="Видалити перенаправлення"
        message={removing ? `${removing.fromPath} → ${removing.toPath}. Після видалення стара адреса перестане вести на нову.` : ''}
        confirmLabel="Видалити перенаправлення"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </>
  )
}
