import { Alert, Button, Select, Stack, TextInput } from '@mantine/core'
import { IconPackage } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { withCsrf } from '@/shared/api/csrf'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import type { CategoryOption } from '../lib/categoryTree'
import { createCatalogProduct } from '../api/catalogApi'
import { CatalogEditorModal } from './CatalogEditorModal'

export function CreateProductModal({ opened, categories, onClose, onCreated }: {
  opened: boolean
  categories: CategoryOption[]
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!categoryId || busy) return
    setBusy(true)
    setError('')
    setErrors({})
    try {
      const result = await withCsrf(headers => createCatalogProduct(headers, { name: name.trim(), sku: sku.trim(), categoryId }))
      if (result.data) onCreated(result.data)
      else {
        setErrors(fieldErrors(result.error))
        setError(problemMessage(result.error, 'Товар не створено.'))
      }
    } catch {
      setError(NETWORK_ERROR)
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setName('')
    setSku('')
    setCategoryId(null)
    setErrors({})
    setError('')
  }

  return (
    <CatalogEditorModal icon={IconPackage} opened={opened} title="Новий товар" onClose={() => { if (!busy) onClose() }}
      dirty={!busy && Boolean(name || sku || categoryId)} onExitTransitionEnd={reset}
      footer={<Button type="submit" form="new-product-form" loading={busy} disabled={!name.trim() || !sku.trim() || !categoryId}>Створити товар</Button>}>
      <form id="new-product-form" onSubmit={submit}>
        <Stack gap="sm">
          <TextInput required data-autofocus label="Назва товару" maxLength={500} value={name} onChange={e => setName(e.currentTarget.value)} error={errors.name} />
          <TextInput required label="Артикул" maxLength={100} value={sku} onChange={e => setSku(e.currentTarget.value)} error={errors.sku} />
          <Select required searchable label="Категорія" data={categories} value={categoryId} onChange={setCategoryId} error={errors.categoryId} />
          {error && <Alert color="red" role="alert">{error}</Alert>}
        </Stack>
      </form>
    </CatalogEditorModal>
  )
}
