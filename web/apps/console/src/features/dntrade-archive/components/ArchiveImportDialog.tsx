import { Alert, Button, FileInput, Progress, ScrollArea, Stack, Text, TextInput } from '@mantine/core'
import { IconFileUpload } from '@tabler/icons-react'
import { useRef, useState, type FormEvent } from 'react'
import { fieldErrors, NETWORK_ERROR, problemMessage } from '@/shared/api/problem'
import type { ApiResult } from '@/shared/api/useApiQuery'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { importArchive, type ArchiveImport } from '../api/archiveApi'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MIN_UPLOAD_INTERVAL_MS = 2_000
const SOURCE_ACCOUNT = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

type ArchiveImportDialogProps = {
  onClose: () => void
  onImported: () => void
}

type ImportSummary = ArchiveImport & { fileNames: string[] }
type ImportProgress = { fileName: string; completed: number; total: number }

const EMPTY_SUMMARY: ImportSummary = { inserted: 0, unchanged: 0, fileNames: [] }
const numberFormat = new Intl.NumberFormat('uk-UA')

function importError(result: ApiResult<ArchiveImport>): string {
  const validations = Object.values(fieldErrors(result.error))
  if (validations.length) return validations.join(' ')

  switch (result.response.status) {
    case 409:
      return problemMessage(result.error, 'Запис з таким ідентифікатором уже є в архіві з іншим вмістом.')
    case 413:
      return problemMessage(result.error, 'Файл має містити до 1 000 записів і важити до 10 МіБ.')
    case 415:
      return problemMessage(result.error, 'Завантажте файл у форматі JSONL або NDJSON.')
    case 429:
      return problemMessage(result.error, 'Забагато спроб імпорту. Зачекайте й повторіть спробу.')
    default:
      return problemMessage(result.error, 'Не вдалося імпортувати файл.')
  }
}

export function ArchiveImportDialog({ onClose, onImported }: ArchiveImportDialogProps) {
  const [sourceAccount, setSourceAccount] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportSummary>(EMPTY_SUMMARY)
  const submitting = useRef(false)
  const accountCode = sourceAccount.trim()
  const validSource = SOURCE_ACCOUNT.test(accountCode)
  const invalidFile = files.find((file) => file.size === 0 || file.size > MAX_FILE_BYTES)
  const busy = progress !== null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || !validSource || files.length === 0 || invalidFile) return

    submitting.current = true
    setError(null)
    let completed = 0
    let imported = summary
    let nextUploadAt = 0
    try {
      for (const file of files) {
        setProgress({ fileName: file.name, completed, total: files.length })
        const waitMs = Math.ceil(nextUploadAt - performance.now())
        if (waitMs > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, waitMs))
        nextUploadAt = performance.now() + MIN_UPLOAD_INTERVAL_MS
        try {
          const response = await importArchive(accountCode, file)
          if (!response.data) {
            setError(`«${file.name}». ${importError(response)}`)
            break
          }

          completed += 1
          imported = {
            fileNames: [...imported.fileNames, file.name],
            inserted: imported.inserted + response.data.inserted,
            unchanged: imported.unchanged + response.data.unchanged,
          }
          setSummary(imported)
        } catch {
          setError(`«${file.name}». ${NETWORK_ERROR}`)
          break
        }
      }
      if (completed > 0) {
        setFiles(files.slice(completed))
        onImported()
      }
    } finally {
      submitting.current = false
      setProgress(null)
    }
  }

  return (
    <AppModal opened title="Імпорт записів Навколо" closeOnClickOutside={!busy} closeOnEscape={!busy} withCloseButton={!busy} onClose={onClose}>
      <form onSubmit={submit} aria-busy={busy}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Виберіть підготовлені файли архіву DNTrade. Файли обробляються по черзі до першої помилки. Повторні записи з тим самим вмістом буде пропущено.
          </Text>
          <TextInput
            label="Код джерела"
            description="Використовуйте той самий код для файлів з одного джерела. Код складається з малих латинських літер, цифр і дефісів."
            value={sourceAccount}
            maxLength={64}
            placeholder="bucha-main"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            required
            data-autofocus
            error={accountCode && !validSource ? 'Код має починатися й закінчуватися малою латинською літерою або цифрою.' : undefined}
            onChange={(event) => {
              setSourceAccount(event.currentTarget.value)
              setError(null)
              setSummary(EMPTY_SUMMARY)
            }}
          />
          <FileInput
            label="Файли JSONL або NDJSON"
            description="Один запис JSON на рядок у кодуванні UTF-8. До 10 МіБ і 1 000 записів у кожному файлі."
            placeholder="Оберіть файли"
            accept=".jsonl,.ndjson,application/x-ndjson,application/ndjson"
            leftSection={<IconFileUpload size={16} stroke={1.7} />}
            clearable
            multiple
            required
            value={files}
            disabled={busy}
            error={invalidFile ? `«${invalidFile.name}». ${invalidFile.size === 0 ? 'Файл порожній.' : 'Файл має важити до 10 МіБ.'}` : undefined}
            onChange={(selected) => {
              setFiles(selected)
              setError(null)
              setSummary(EMPTY_SUMMARY)
            }}
          />
          {progress ? (
            <Stack gap={4}>
              <Text size="sm" role="status" style={{ overflowWrap: 'anywhere' }}>
                Файл {progress.completed + 1} з {progress.total} · {progress.fileName}
              </Text>
              <Progress value={(progress.completed / progress.total) * 100} aria-label="Оброблено файлів" />
            </Stack>
          ) : null}
          {error ? <Alert color="red" role="alert">{error}</Alert> : null}
          {summary.fileNames.length > 0 ? (
            <Alert color="green" role="status">
              <Text size="sm" fw={600}>
                Оброблено файлів {numberFormat.format(summary.fileNames.length)}. Додано записів {numberFormat.format(summary.inserted)}. Уже в архіві {numberFormat.format(summary.unchanged)}.
              </Text>
              <ScrollArea.Autosize mah={144} type="auto" mt={4}>
                <ul style={{ margin: 0, paddingInlineStart: 20, overflowWrap: 'anywhere' }}>
                  {summary.fileNames.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}
                </ul>
              </ScrollArea.Autosize>
            </Alert>
          ) : null}
        </Stack>
        <AppModalFooter>
          <Button variant="default" disabled={busy} onClick={onClose}>Закрити</Button>
          <Button type="submit" loading={busy} disabled={!validSource || files.length === 0 || !!invalidFile}>Імпортувати в архів</Button>
        </AppModalFooter>
      </form>
    </AppModal>
  )
}
