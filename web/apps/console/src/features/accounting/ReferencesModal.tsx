import { ActionIcon, Alert, Button, Group, SegmentedControl, Stack, Text, TextInput } from '@mantine/core'
import { IconBuilding, IconBuildingWarehouse, IconCheck, IconPencil, IconPlus, IconX } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { problemMessage } from '@/shared/api/problem'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { notifySuccess } from '@/shared/ui/notify'
import { PageState } from '@/shared/ui/PageState'
import { save, useRegister, type Ref } from './api'

type RefKind = 'organizations' | 'stores'

export function ReferencesModal({ close, onChanged }: { close: () => void; onChanged: () => void }) {
  const [opened, setOpened] = useState(true)
  const [tab, setTab] = useState<RefKind>('organizations')
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refs = useRegister<{ organizations: Ref[]; stores: Ref[] }>('references')
  const items = tab === 'organizations' ? (refs.data?.organizations ?? []) : (refs.data?.stores ?? [])
  const noun = tab === 'organizations' ? 'організацію' : 'склад'

  async function createItem(event: FormEvent) {
    event.preventDefault()
    const title = newTitle.trim()
    if (busy || !title) return
    setBusy(true)
    setError('')
    try {
      const result = await save<Ref>('references/' + tab, { title }, 'POST')
      if (!result.response.ok) {
        setError(problemMessage(result.error, `Не вдалося створити ${noun}.`))
        return
      }
      setNewTitle('')
      notifySuccess(tab === 'organizations' ? 'Організацію створено.' : 'Склад створено.')
      refs.reload()
      onChanged()
    } catch {
      setError('Немає зв’язку із сервером. Повторіть дію.')
    } finally {
      setBusy(false)
    }
  }

  async function renameItem(event: FormEvent) {
    event.preventDefault()
    const title = editingTitle.trim()
    if (busy || !editingId || !title) return
    setBusy(true)
    setError('')
    try {
      const result = await save<Ref>('references/' + tab + '/' + encodeURIComponent(editingId), { title }, 'PUT')
      if (!result.response.ok) {
        setError(problemMessage(result.error, `Не вдалося перейменувати ${noun}.`))
        return
      }
      setEditingId(null)
      setEditingTitle('')
      notifySuccess(tab === 'organizations' ? 'Назву організації оновлено.' : 'Назву складу оновлено.')
      refs.reload()
      onChanged()
    } catch {
      setError('Немає зв’язку із сервером. Повторіть дію.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppEditorModal
      opened={opened}
      className="ledger-editor warehouse-modal"
      size="standard"
      onClose={() => { if (!busy) setOpened(false) }}
      onExitTransitionEnd={close}
      title={<MetricLabel icon={IconBuilding}>Організації та склади</MetricLabel>}
      footer={
        <Button variant="default" disabled={busy} onClick={() => setOpened(false)}>
          Закрити
        </Button>
      }
    >
      <Stack gap="sm">
        <SegmentedControl
          value={tab}
          onChange={(value) => {
            setTab(value === 'stores' ? 'stores' : 'organizations')
            setEditingId(null)
            setEditingTitle('')
            setError('')
          }}
          data={[
            { value: 'organizations', label: `Організації (ФОП) · ${refs.data?.organizations.length ?? '—'}` },
            { value: 'stores', label: `Склади · ${refs.data?.stores.length ?? '—'}` },
          ]}
        />

        <section className="ledger-form-block">
          <MetricLabel icon={tab === 'organizations' ? IconBuilding : IconBuildingWarehouse}>
            {tab === 'organizations' ? 'Нова організація (ФОП)' : 'Новий склад'}
          </MetricLabel>
          <form onSubmit={createItem}>
            <Group align="end" gap="xs" wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                label="Назва"
                placeholder={tab === 'organizations' ? 'Наприклад: ФОП Мельниченко О. В.' : 'Наприклад: Основний склад'}
                maxLength={200}
                value={newTitle}
                disabled={busy}
                onChange={(e) => setNewTitle(e.currentTarget.value)}
              />
              <Button type="submit" loading={busy} disabled={!newTitle.trim()} leftSection={<IconPlus size={15} />}>
                Додати
              </Button>
            </Group>
          </form>
        </section>

        {error && <Alert color="red" role="alert">{error}</Alert>}

        <section className="ledger-form-block">
          <MetricLabel icon={tab === 'organizations' ? IconBuilding : IconBuildingWarehouse}>
            {tab === 'organizations' ? 'Наявні організації' : 'Наявні склади'}
          </MetricLabel>
          {refs.data ? (
            items.length > 0 ? (
              <Stack gap="xs">
                {items.map((item) =>
                  editingId === item.id ? (
                    <form key={item.id} onSubmit={renameItem}>
                      <Group gap="xs" wrap="nowrap">
                        <TextInput
                          style={{ flex: 1 }}
                          aria-label="Нова назва"
                          maxLength={200}
                          value={editingTitle}
                          disabled={busy}
                          onChange={(e) => setEditingTitle(e.currentTarget.value)}
                          autoFocus
                        />
                        <ActionIcon type="submit" variant="filled" aria-label="Зберегти назву" loading={busy} disabled={!editingTitle.trim()}>
                          <IconCheck size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="default"
                          aria-label="Скасувати перейменування"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(null)
                            setEditingTitle('')
                          }}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    </form>
                  ) : (
                    <Group key={item.id} justify="space-between" wrap="nowrap" gap="xs">
                      <Text size="sm" fw={500}>{item.title}</Text>
                      <Button
                        size="compact-xs"
                        variant="default"
                        leftSection={<IconPencil size={13} />}
                        disabled={busy}
                        onClick={() => {
                          setEditingId(item.id)
                          setEditingTitle(item.title)
                          setError('')
                        }}
                      >
                        Перейменувати
                      </Button>
                    </Group>
                  ),
                )}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                {tab === 'organizations' ? 'Організацій ще немає.' : 'Складів ще немає.'}
              </Text>
            )
          ) : (
            <PageState kind={refs.status === 'ready' ? 'empty' : refs.status} onRetry={refs.reload} />
          )}
        </section>
      </Stack>
    </AppEditorModal>
  )
}
