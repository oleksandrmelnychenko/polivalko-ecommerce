import { ActionIcon, Button, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react'
import { useMemo, useState, type FormEvent } from 'react'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { ListPageBody } from '@/shared/ui/ListPage'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { createRedirect, deleteRedirect, getRedirects, type ConsoleRedirect } from '../api/siteApi'
import '@/shared/ui/filter-bar.css'

const getRowId = (row: ConsoleRedirect) => row.id
const countFormat = new Intl.NumberFormat('uk-UA')

export function RedirectsPanel() {
  const redirects = useApiQuery('site-redirects', () => getRedirects())
  const [fromPath, setFromPath] = useState('')
  const [toPath, setToPath] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<ConsoleRedirect | null>(null)
  const [busy, setBusy] = useState(false)

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
        redirects.reload()
      } else {
        const byField = fieldErrors(result.error)
        setErrors(byField)
        if (!byField.fromPath && !byField.toPath) notifyError(problemMessage(result.error, 'Не збережено.'))
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
        notifyError(problemMessage(result.error, 'Не видалено.'))
      }
    } catch {
      notifyError(NETWORK_ERROR)
    }
    setBusy(false)
    setRemoving(null)
  }

  const columns = useMemo<DataTableColumn<ConsoleRedirect>[]>(
    () => [
      {
        id: 'from',
        header: 'Стара адреса',
        width: 320,
        fill: true,
        cell: (row) => (
          <span className="site-code site-ellipsis" title={row.fromPath}>
            {row.fromPath}
          </span>
        ),
      },
      {
        id: 'to',
        header: 'Нова адреса',
        width: 320,
        cell: (row) => (
          <span className="site-code site-ellipsis" title={row.toPath}>
            {row.toPath}
          </span>
        ),
      },
      {
        id: 'created',
        header: 'Як створено',
        width: 250,
        cell: (row) => (
          <span>
            {row.isAutomatic ? 'Автоматично' : 'Вручну'}, <span className="site-muted">{formatDateTime(row.createdAt)}</span>
          </span>
        ),
      },
      {
        id: 'delete',
        header: <span className="visually-hidden">Дія</span>,
        width: 56,
        align: 'center',
        cell: (row) => (
          <Tooltip label="Видалити">
            <ActionIcon variant="subtle" color="red" aria-label={`Видалити перенаправлення ${row.fromPath}`} onClick={() => setRemoving(row)}>
              <IconTrash size={16} stroke={1.7} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [],
  )

  const emptyText =
    redirects.status === 'error' || redirects.status === 'forbidden' ? (
      <Stack align="center" gap={8}>
        <Text size="sm">{problemMessage(redirects.problem, 'Не вдалося завантажити перенаправлення.')}</Text>
        <Button size="xs" variant="default" onClick={redirects.reload}>
          Спробувати ще раз
        </Button>
      </Stack>
    ) : (
      "Перенаправлень ще немає: вони з'являються після зміни адреси товару чи категорії."
    )

  return (
    <>
      <PageHeader title="Перенаправлення" />

      <form className="app-filter-bar site-create-bar" noValidate onSubmit={create} aria-label="Нове перенаправлення">
        <div className="app-filter-fields">
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
          <Button type="submit" className="site-create-submit" leftSection={<IconPlus size={16} stroke={1.8} />} loading={creating}>
            Додати
          </Button>
        </div>
        <div className="app-filter-actions">
          {redirects.data ? <span className="app-filter-summary site-summary">Усього: {countFormat.format(redirects.data.length)}</span> : null}
          <Tooltip label="Оновити">
            <ActionIcon variant="subtle" color="gray" aria-label="Оновити" loading={redirects.isFetching} onClick={redirects.reload}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </div>
      </form>

      <ListPageBody>
        <DataTable
          ariaLabel="Перенаправлення"
          columns={columns}
          data={redirects.status === 'error' || redirects.status === 'forbidden' ? [] : (redirects.data ?? [])}
          getRowId={getRowId}
          isLoading={redirects.isLoading}
          isFetching={redirects.isFetching}
          minWidth={900}
          height="100%"
          manualSorting
          emptyText={emptyText}
        />
      </ListPageBody>

      <ConfirmDialog
        opened={removing !== null}
        title="Видалити перенаправлення"
        message={removing ? `${removing.fromPath} → ${removing.toPath}` : ''}
        confirmLabel="Видалити"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </>
  )
}
