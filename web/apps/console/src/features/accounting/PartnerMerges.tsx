import { Alert, Button, Checkbox, Group, Radio, Select, Stack, Text } from '@mantine/core'
import { IconArrowMerge } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { problemMessage } from '@/shared/api/problem'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PARTNER_NAMES_CHANGED } from './PartnerNames'
import { read, save, useRegister, type Page, type Partner } from './api'

const describe = (p: Partner) => [p.title, p.note, p.category, p.sourceId].filter(Boolean).join(' · ')

function useDocumentCounts(ids: string[]) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const key = ids.join(',')
  useEffect(() => {
    let live = true
    for (const id of key ? key.split(',') : []) {
      read<Page<unknown>>('documents?partnerId=' + id).then((r) => {
        if (live && r.data) setCounts((all) => ({ ...all, [id]: r.data!.total }))
      }).catch(() => undefined)
    }
    return () => { live = false }
  }, [key])
  return counts
}

/** Merges duplicate cards into one main card. The duplicates stay as aliases, so the merge can be undone. */
export function PartnerMergeDialog({ initial, mainId, close, saved }: {
  initial: Partner[]; mainId?: string; close: () => void; saved: () => void
}) {
  const [cards, setCards] = useState(initial)
  const counts = useDocumentCounts(cards.map((c) => c.id))
  const busiest = [...cards].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))[0]?.id
  const [chosenMain, setMain] = useState<string | null>(mainId ?? null)
  const main = chosenMain ?? busiest ?? null
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [term, setTerm] = useState('')
  const search = useRegister<Page<Partner>>('partners?q=' + encodeURIComponent(term.trim()), term.trim().length >= 2)
  const [opened, setOpened] = useState(true)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const duplicates = cards.filter((c) => c.id !== main && !skipped.has(c.id))
  async function confirm() {
    if (!main || !duplicates.length || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await save('partners/' + main + '/merge', { duplicates: duplicates.map((c) => c.id) })
      if (!result.response.ok) setError(problemMessage(result.error, 'Не вдалося об’єднати картки.'))
      else {
        window.dispatchEvent(new Event(PARTNER_NAMES_CHANGED))
        setDone(true)
        setOpened(false)
      }
    } catch {
      setError('Немає зв’язку з сервером. Повторіть об’єднання.')
    } finally {
      setBusy(false)
    }
  }
  const mainCard = cards.find((c) => c.id === main)
  return (
    <AppEditorModal opened={opened} size="standard" className="ledger-editor partner-merge"
      onClose={() => { if (!busy) setOpened(false) }} onExitTransitionEnd={done ? saved : close}
      title={<MetricLabel icon={IconArrowMerge}>Об’єднання карток контрагента</MetricLabel>}
      footer={<Group gap="xs">
        <Button variant="default" disabled={busy} onClick={() => setOpened(false)}>Скасувати</Button>
        <Button loading={busy} disabled={!main || !duplicates.length} onClick={confirm}>
          Об’єднати · {duplicates.length}
        </Button>
      </Group>}>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Оберіть основну картку. Документи, борги, пропозиції й прив’язки у звірці інших карток перейдуть на неї,
          а самі картки зникнуть зі списку й лишаться в основній як об’єднані. Об’єднання можна скасувати.
        </Text>
        <Radio.Group value={main} onChange={setMain} label="Основна картка">
          <Stack gap={6} mt={6}>
            {cards.map((c) => (
              <Group key={c.id} gap="sm" wrap="nowrap" className="partner-merge-row">
                <Radio value={c.id} label={describe(c)} />
                <Text size="xs" c="dimmed" className="partner-merge-count">
                  {counts[c.id] == null ? '…' : `${counts[c.id]} док.`}
                </Text>
                {c.id !== main && (
                  <Checkbox size="xs" label="Приєднати" checked={!skipped.has(c.id)} onChange={(e) => {
                    const on = e.currentTarget.checked
                    setSkipped((all) => {
                      const next = new Set(all)
                      if (on) next.delete(c.id)
                      else next.add(c.id)
                      return next
                    })
                  }} />
                )}
              </Group>
            ))}
          </Stack>
        </Radio.Group>
        <Select
          label="Додати ще картку"
          placeholder="Почніть вводити назву або код"
          searchable
          clearable
          value={null}
          searchValue={term}
          onSearchChange={setTerm}
          nothingFoundMessage={term.trim().length < 2 ? 'Введіть щонайменше 2 символи' : 'Нічого не знайдено'}
          data={(search.data?.items ?? []).filter((p) => !cards.some((c) => c.id === p.id))
            .map((p) => ({ value: p.id, label: describe(p) }))}
          onChange={(id) => {
            const card = search.data?.items.find((p) => p.id === id)
            if (card) setCards((all) => [...all, card])
            setTerm('')
          }}
        />
        {mainCard && duplicates.length > 0 && (
          <Text size="sm">
            Залишиться «{mainCard.title}», приєднаються: {duplicates.map((c) => `«${c.title}»`).join(', ')}.
          </Text>
        )}
        {error && <Alert color="red" role="alert">{error}</Alert>}
      </Stack>
    </AppEditorModal>
  )
}

export async function unmergePartner(id: string) {
  const result = await save('partners/' + id + '/unmerge', {})
  if (result.response.ok) window.dispatchEvent(new Event(PARTNER_NAMES_CHANGED))
  return result.response.ok ? '' : problemMessage(result.error, 'Не вдалося скасувати об’єднання.')
}
