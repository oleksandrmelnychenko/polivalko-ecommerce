import { Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { IconArrowsRightLeft, IconExternalLink, IconPlus, IconTrash } from '@tabler/icons-react'
import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { siteUrl } from '@/shared/lib/siteUrl'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { DrawerCancelButton } from '@/shared/ui/DrawerCancelButton'
import { SiteRecordWorkspace } from '@/shared/ui/site/SiteRecordWorkspace'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { notifyError, notifySuccess } from '@/shared/ui/notify'
import { PageHeader } from '@/shared/ui/PageHeader'
import { createRedirect, deleteRedirect, getRedirects, type ConsoleRedirect } from '../api/siteApi'
import '@/shared/ui/split/split.css'

export function RedirectsPanel() {
  const redirects = useApiQuery('site-redirects', () => getRedirects())
  const [opened, setOpened] = useState(false)
  const [fromPath, setFromPath] = useState('')
  const [toPath, setToPath] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<ConsoleRedirect | null>(null)
  const [busy, setBusy] = useState(false)
  const failed = redirects.status === 'error' || redirects.status === 'forbidden'
  const rows = useMemo(() => (failed ? [] : (redirects.data ?? [])), [failed, redirects.data])
  const [, setParams] = useSearchParams()
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
        setOpened(false)
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
      <PageHeader title="Перенаправлення" actions={
        <Button leftSection={<IconPlus size={16} />} onClick={() => {
          setFromPath('')
          setToPath('')
          setErrors({})
          setOpened(true)
        }}>Нове перенаправлення</Button>
      } />
      <SiteRecordWorkspace
        title="Адреси" parameter="id" loading={redirects.isLoading} refreshing={redirects.isFetching} refresh={redirects.reload} empty={emptyText}
        rows={rows.map(row => ({
          id: row.id, name: row.fromPath, detail: '→ ' + row.toPath, icon: <IconArrowsRightLeft size={16} />,
        }))}
      >
        {id => {
          const selected = rows.find(row => row.id === id)
          return selected && (
            <div className="app-split-detail">
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
            </div>
          )
        }}
      </SiteRecordWorkspace>
      <AppEditorModal opened={opened} title="Нове перенаправлення" className="site-record-modal"
        onClose={() => { if (!creating) setOpened(false) }} dirty={!creating && Boolean(fromPath || toPath)}
        closeOnEscape={!creating} closeOnClickOutside={!creating}
        footer={<Group gap="sm"><DrawerCancelButton disabled={creating} onCancel={() => setOpened(false)} />
          <Button type="submit" form="site-redirect-form" loading={creating}>Додати</Button></Group>}>
        <form id="site-redirect-form" onSubmit={create} noValidate>
          <Stack gap="sm">
            <TextInput
              label="Стара адреса"
              data-autofocus
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
          </Stack>
        </form>
      </AppEditorModal>

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
