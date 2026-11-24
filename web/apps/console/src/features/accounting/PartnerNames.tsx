import { Alert, Button, Checkbox, Group, Stack, Text, TextInput } from '@mantine/core'
import { IconPencil, IconSparkles } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import type { components } from '@polivalko/shared/api/schema'
import { problemMessage } from '@/shared/api/problem'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { TableChip } from '@/shared/ui/TableChip'
import { duplicateKey, suggestPartnerName } from './lib/partnerNames'
import { save, type Partner } from './api'

type Change = components['schemas']['PartnerNameChange']
type Draft = { title: string; note: string; checked: boolean }

export const PARTNER_NAMES_CHANGED = 'partner-names-changed'
const clean = (text: string) => text.trim().replace(/\s+/g, ' ')
const noteOf = (text: string) => clean(text) || null

/** Partners whose name the cleanup rules would change. */
export function namesToClean(rows: Partner[]) {
  return rows.flatMap((row) => {
    const next = suggestPartnerName(row.title, row.note)
    return next.title !== row.title || next.note !== (row.note ?? null) ? [{ row, next }] : []
  })
}

async function submit(changes: Change[]) {
  const result = await save('partners/names', { changes })
  return result.response.ok ? '' : problemMessage(result.error, 'Не вдалося зберегти назви.')
}

function useSave(saved: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(changes: Change[]) {
    if (busy || !changes.length) return
    setBusy(true)
    setError('')
    try {
      const message = await submit(changes)
      if (message) setError(message)
      else {
        window.dispatchEvent(new Event(PARTNER_NAMES_CHANGED))
        saved()
      }
    } catch {
      setError('Немає зв’язку з сервером. Повторіть збереження.')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

export function PartnerNameCleanup({ rows, close, saved }: { rows: Partner[]; close: () => void; saved: () => void }) {
  const items = useMemo(() => namesToClean(rows), [rows])
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(items.map(({ row, next }) => [row.id, { title: next.title, note: next.note ?? '', checked: true }])),
  )
  const [opened, setOpened] = useState(true)
  const [done, setDone] = useState(false)
  const { busy, error, run } = useSave(() => {
    setDone(true)
    setOpened(false)
  })
  const counts = new Map<string, number>()
  for (const row of rows) {
    const draft = drafts[row.id]
    const key = duplicateKey(draft?.checked ? draft.title : row.title)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const chosen = items.filter(({ row }) => drafts[row.id]?.checked && clean(drafts[row.id].title))
  const change = (id: string, patch: Partial<Draft>) => setDrafts((all) => ({ ...all, [id]: { ...all[id], ...patch } }))
  const allChecked = items.length > 0 && items.every(({ row }) => drafts[row.id]?.checked)
  return (
    <AppEditorModal opened={opened} size="wide" className="ledger-editor partner-cleanup"
      onClose={() => { if (!busy) setOpened(false) }} onExitTransitionEnd={done ? saved : close}
      title={<MetricLabel icon={IconSparkles}>Чистка назв контрагентів</MetricLabel>}
      footer={<Group gap="xs">
        <Button variant="default" disabled={busy} onClick={() => setOpened(false)}>Скасувати</Button>
        <Button loading={busy} disabled={!chosen.length} onClick={() => run(chosen.map(({ row }) => ({
          id: row.id, title: clean(drafts[row.id].title), note: noteOf(drafts[row.id].note),
          previousTitle: row.title, previousNote: row.note ?? null,
        })))}>Застосувати · {chosen.length}</Button>
      </Group>}>
      <Stack gap="sm" className="partner-cleanup-body">
        <Text size="sm" c="dimmed">
          Пробіли, лапки «…», форма ФОП/ТОВ, а дужки й частини після скісної риски — в опис.
          Перевірте кожен рядок; зняті галочки не змінюються. Назва з DNTrade зберігається для звірки звітів.
        </Text>
        {!items.length ? <Text>Усі назви вже охайні.</Text> : (
          <table className="partner-table partner-cleanup-table">
            <thead>
              <tr>
                <th scope="col">
                  <Checkbox aria-label="Вибрати всі" checked={allChecked}
                    indeterminate={!allChecked && items.some(({ row }) => drafts[row.id]?.checked)}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked
                      setDrafts((all) => Object.fromEntries(Object.entries(all).map(([id, d]) => [id, { ...d, checked }])))
                    }} />
                </th>
                <th scope="col">Було</th>
                <th scope="col">Нова назва</th>
                <th scope="col">Опис</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ row }) => {
                const draft = drafts[row.id]
                const clash = draft.checked && (counts.get(duplicateKey(draft.title)) ?? 0) > 1
                return (
                  <tr key={row.id} data-off={draft.checked ? undefined : ''}>
                    <td><Checkbox aria-label={'Змінити ' + row.title} checked={draft.checked}
                      onChange={(e) => change(row.id, { checked: e.currentTarget.checked })} /></td>
                    <td data-label="Було" className="partner-cleanup-was">
                      <code>{row.title}</code>
                      {row.note && <small>{row.note}</small>}
                      {row.category && <small>{row.category}</small>}
                    </td>
                    <td data-label="Нова назва">
                      <TextInput aria-label="Нова назва" value={draft.title} maxLength={300} disabled={!draft.checked}
                        error={draft.checked && !clean(draft.title) ? 'Вкажіть назву' : undefined}
                        onChange={(e) => change(row.id, { title: e.currentTarget.value })} />
                      {clash && <TableChip tone="warning" value="Збігається з іншим контрагентом" />}
                    </td>
                    <td data-label="Опис">
                      <TextInput aria-label="Опис" value={draft.note} maxLength={500} disabled={!draft.checked}
                        onChange={(e) => change(row.id, { note: e.currentTarget.value })} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {error && <Alert color="red" role="alert">{error}</Alert>}
      </Stack>
    </AppEditorModal>
  )
}

export function PartnerNameEditor({ partner, close, saved }: { partner: Partner; close: () => void; saved: () => void }) {
  const [title, setTitle] = useState(partner.title)
  const [note, setNote] = useState(partner.note ?? '')
  const [opened, setOpened] = useState(true)
  const [done, setDone] = useState(false)
  const { busy, error, run } = useSave(() => {
    setDone(true)
    setOpened(false)
  })
  const suggestion = suggestPartnerName(title, noteOf(note))
  const canSuggest = suggestion.title !== clean(title) || (suggestion.note ?? '') !== clean(note)
  const changed = clean(title) !== partner.title || noteOf(note) !== (partner.note ?? null)
  return (
    <AppEditorModal opened={opened} className="ledger-editor"
      onClose={() => { if (!busy) setOpened(false) }} onExitTransitionEnd={done ? saved : close}
      title={<MetricLabel icon={IconPencil}>Назва контрагента</MetricLabel>}
      footer={<Group gap="xs">
        <Button variant="default" disabled={busy} onClick={() => setOpened(false)}>Скасувати</Button>
        <Button loading={busy} disabled={!changed || !clean(title)} onClick={() => run([{
          id: partner.id, title: clean(title), note: noteOf(note), previousTitle: partner.title, previousNote: partner.note ?? null,
        }])}>Зберегти</Button>
      </Group>}>
      <section className="ledger-form-block">
        <TextInput label="Назва" value={title} maxLength={300} required
          error={!clean(title) ? 'Вкажіть назву' : undefined} onChange={(e) => setTitle(e.currentTarget.value)} />
        <TextInput label="Опис" description="Що постачає, хто це, примітка — усе, що не є назвою"
          value={note} maxLength={500} onChange={(e) => setNote(e.currentTarget.value)} />
        {canSuggest && (
          <Button variant="light" size="xs" leftSection={<IconSparkles size={14} />} w="fit-content" onClick={() => {
            setTitle(suggestion.title)
            setNote(suggestion.note ?? '')
          }}>
            Охайно: {suggestion.title}{suggestion.note ? ' · ' + suggestion.note : ''}
          </Button>
        )}
        {error && <Alert color="red" role="alert">{error}</Alert>}
      </section>
    </AppEditorModal>
  )
}
