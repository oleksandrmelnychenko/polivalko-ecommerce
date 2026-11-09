import { Alert, Button, Group, Text, Textarea } from '@mantine/core'
import { IconAlertTriangle, IconPencil } from '@tabler/icons-react'
import { useState } from 'react'
import { usePermissions } from '@/features/auth'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { notifySuccess } from '@/shared/ui/notify'
import { saveOrderNote, type ConsoleOrder } from '../api/orderDetailApi'
import { OrderCard, OrderCardBody } from './OrderCard'

const NOTE_LIMIT = 1000

type OrderNoteCardProps = {
  order: ConsoleOrder
  onSaved: (order: ConsoleOrder) => void
}

export function OrderNoteCard({ order, onSaved }: OrderNoteCardProps) {
  const { can } = usePermissions()
  const canEdit = can(PermissionKeys.Orders.ChangeStatus)
  const note = order.internalNote ?? ''
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editing = draft !== null

  if (!canEdit && !note) return null

  async function save() {
    if (draft === null) return
    const value = draft.trim()
    setBusy(true)
    setError(null)
    try {
      const result = await withCsrf((headers) => saveOrderNote(headers, order.number, value))
      if (result.response.ok) {
        onSaved(result.data ?? { ...order, internalNote: value || null })
        setDraft(null)
        notifySuccess(value ? 'Нотатку збережено.' : 'Нотатку видалено.')
      } else {
        setError(problemMessage(result.error, 'Нотатку не збережено.'))
      }
    } catch {
      setError(NETWORK_ERROR)
    } finally {
      setBusy(false)
    }
  }

  return (
    <OrderCard
      className="order-area-note order-no-print"
      title="Нотатка для працівників"
      aside={
        canEdit && !editing ? (
          <Button variant="subtle" size="compact-sm" leftSection={<IconPencil size={14} stroke={1.8} />} onClick={() => setDraft(note)}>
            {note ? 'Змінити' : 'Додати'}
          </Button>
        ) : null
      }
    >
      <OrderCardBody>
        {editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <Textarea
              label="Нотатка"
              description="Покупець цю нотатку не бачить."
              autosize
              minRows={3}
              maxRows={10}
              maxLength={NOTE_LIMIT}
              value={draft}
              disabled={busy}
              autoFocus
              onChange={(event) => setDraft(event.currentTarget.value)}
            />
            <Group justify="space-between" mt="xs" gap={8}>
              <Text size="xs" c="dimmed" className="order-note-counter">
                {draft.length} / {NOTE_LIMIT}
              </Text>
              <Group gap={8}>
                <Button
                  variant="default"
                  size="xs"
                  disabled={busy}
                  onClick={() => {
                    setDraft(null)
                    setError(null)
                  }}
                >
                  Скасувати
                </Button>
                <Button type="submit" size="xs" loading={busy} disabled={draft.trim() === note.trim()}>
                  Зберегти нотатку
                </Button>
              </Group>
            </Group>
          </form>
        ) : note ? (
          <p className="order-note-text">{note}</p>
        ) : (
          <Text size="sm" c="dimmed">
            Нотатки ще немає. Тут можна записати домовленості з покупцем, він їх не побачить.
          </Text>
        )}
        {error ? (
          <Alert mt="sm" color="red" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
            {error}
          </Alert>
        ) : null}
      </OrderCardBody>
    </OrderCard>
  )
}
