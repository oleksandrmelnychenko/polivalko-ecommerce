import { Alert, Button, Select, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useMemo, useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { mergeBrand, type Brand } from '../api/dictionariesApi'

type BrandMergeDialogProps = {
  source: Brand | null
  brands: Brand[]
  onMerged: (source: Brand, target: Brand) => void
  onClose: () => void
}

export function BrandMergeDialog({ source, brands, onMerged, onClose }: BrandMergeDialogProps) {
  const [targetId, setTargetId] = useState<string | null>(null)
  const [seen, setSeen] = useState(source)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (seen !== source) {
    setSeen(source)
    setTargetId(null)
    setError(null)
  }

  const options = useMemo(
    () =>
      brands
        .filter((brand) => brand.id !== source?.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'uk'))
        .map((brand) => ({ value: brand.id, label: `${brand.name} · ${brand.productCount} тов.` })),
    [brands, source],
  )
  const target = brands.find((brand) => brand.id === targetId) ?? null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!source || !target || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await withCsrf((headers) => mergeBrand(headers, source.id, target.id))
      if (result.response.ok) {
        setBusy(false)
        onMerged(source, target)
        return
      }
      setError(problemMessage(result.error, "Бренди не об'єднано."))
    } catch {
      setError(NETWORK_ERROR)
    }
    setBusy(false)
  }

  return (
    <AppModal
      opened={source !== null}
      title={source ? `Об'єднати «${source.name}» з…` : "Об'єднати бренди"}
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      withCloseButton={!busy}
      onClose={onClose}
    >
      <form noValidate onSubmit={submit} aria-label="Об'єднати бренди">
        <Stack gap="sm">
          <Text size="sm">Так зводять різні написання одного бренду, наприклад «GARDENA» і «Gardena».</Text>
          <Select
            label="Залишити бренд"
            placeholder="Оберіть бренд"
            data={options}
            value={targetId}
            searchable
            nothingFoundMessage="Нічого не знайдено"
            comboboxProps={{ withinPortal: true }}
            onChange={setTargetId}
            data-autofocus
          />
          {source && target ? (
            <Alert color="yellow" variant="light">
              Товари «{source.name}» ({source.productCount}) перейдуть до «{target.name}», а «{source.name}» буде видалено з довідника. Скасувати це не можна.
            </Alert>
          ) : null}
          {error ? (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
              {error}
            </Alert>
          ) : null}
        </Stack>
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" color="red" loading={busy} disabled={!target}>
            Об&apos;єднати
          </Button>
        </AppModalFooter>
      </form>
    </AppModal>
  )
}
