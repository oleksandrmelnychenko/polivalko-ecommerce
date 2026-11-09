import { Button, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { IconDeviceFloppy, IconExternalLink } from '@tabler/icons-react'
import { useDeferredValue, useEffect, useRef, useState, type FormEvent } from 'react'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { useAuth } from '@/features/auth'
import { siteUrl } from '@/shared/lib/siteUrl'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableChip } from '@/shared/ui/TableChip'
import { savePage, type ContentPage } from '../api/contentApi'
import { previewDocument } from '../lib/previewDocument'
import { useSaveForm } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { PageEditorHeading } from './PageEditorHeading'
import { PageSeoFields } from './PageSeoFields'

const FORM_ID = 'content-page-editor'

type PageEditorProps = {
  initial: ContentPage
  onSaved: (page: ContentPage) => void
}

export function PageEditor({ initial, onSaved }: PageEditorProps) {
  const { me } = useAuth()
  const form = useSaveForm()
  const formRef = useRef<HTMLFormElement>(null)
  const [saved, setSaved] = useState(initial)
  const [savedBy, setSavedBy] = useState<string | null>(null)
  const [title, setTitle] = useState(initial.title)
  const [lead, setLead] = useState(initial.lead ?? '')
  const [body, setBody] = useState(initial.bodyHtml ?? '')
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription ?? '')
  const draft = useDeferredValue(body)

  const dirty =
    title !== saved.title ||
    lead !== (saved.lead ?? '') ||
    body !== (saved.bodyHtml ?? '') ||
    seoTitle !== (saved.seoTitle ?? '') ||
    seoDescription !== (saved.seoDescription ?? '')
  const draftShown = draft !== (saved.bodyHtml ?? '')
  const who = savedBy ?? saved.updatedBy

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useHotkeys([['mod+S', () => formRef.current?.requestSubmit()]], [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!dirty || form.busy) return
    const result = await form.submit(
      (headers) =>
        savePage(headers, saved.slug, {
          title: title.trim(),
          lead: lead.trim() || null,
          bodyHtml: body.trim() || null,
          seoTitle: seoTitle.trim() || null,
          seoDescription: seoDescription.trim() || null,
        }),
      { done: 'Сторінку збережено. У полі тепер текст, очищений сервером.', failed: 'Сторінку не збережено.' },
    )
    if (!result?.data) return
    const page = result.data
    setSaved(page)
    setSavedBy(me?.displayName ?? null)
    setTitle(page.title)
    setLead(page.lead ?? '')
    setBody(page.bodyHtml ?? '')
    setSeoTitle(page.seoTitle ?? '')
    setSeoDescription(page.seoDescription ?? '')
    onSaved(page)
  }

  return (
    <div className="content-editor-page">
      <PageHeader
        title={saved.title}
        heading={<PageEditorHeading title={saved.title} />}
        actions={
          <>
            <Button
              component="a"
              href={siteUrl(`/${saved.slug}`)}
              target="_blank"
              rel="noopener"
              variant="default"
              leftSection={<IconExternalLink size={16} stroke={1.8} />}
            >
              Відкрити на сайті
            </Button>
            <Button type="submit" form={FORM_ID} loading={form.busy} disabled={!dirty} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
              Зберегти сторінку
            </Button>
          </>
        }
      />
      <form id={FORM_ID} ref={formRef} className="content-editor" onSubmit={onSubmit} noValidate aria-label={`Редагування сторінки «${saved.title}»`}>
        <div className="content-editor-pane">
          <Stack gap="md">
            <Text size="sm" c="dimmed" className="content-editor-meta">
              оновлено {formatDateTime(saved.updatedAt)}
              {who ? `, ${who}` : ''}
            </Text>
            <FormAlert error={form.error} />
            <TextInput
              label="Заголовок"
              value={title}
              maxLength={200}
              required
              error={form.errors.title}
              onChange={(event) => {
                setTitle(event.currentTarget.value)
                form.clearField('title')
              }}
            />
            <Textarea
              label="Підзаголовок"
              description="Абзац під заголовком, до 500 символів. Можна лишити порожнім."
              value={lead}
              maxLength={500}
              autosize
              minRows={3}
              error={form.errors.lead}
              onChange={(event) => {
                setLead(event.currentTarget.value)
                form.clearField('lead')
              }}
            />
            <Textarea
              label="Текст сторінки, HTML"
              description="Дозволено абзаци, заголовки h2, h3 і h4, списки, цитати, таблиці й посилання (http, https, mailto, tel). Решту розмітки, стилі й скрипти сервер прибирає під час збереження."
              classNames={{ input: 'content-code-input' }}
              value={body}
              autosize
              minRows={18}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              error={form.errors.bodyHtml}
              onChange={(event) => {
                setBody(event.currentTarget.value)
                form.clearField('bodyHtml')
              }}
            />
            <PageSeoFields
              slug={saved.slug}
              title={title}
              seoTitle={seoTitle}
              seoDescription={seoDescription}
              errors={form.errors}
              onChange={(field, value) => {
                if (field === 'seoTitle') setSeoTitle(value)
                else setSeoDescription(value)
                form.clearField(field)
              }}
            />
          </Stack>
        </div>

        <section className="content-editor-pane content-preview" aria-labelledby="content-preview-title">
          <div className="content-preview-head">
            <h2 id="content-preview-title" className="app-section-title">
              Перегляд
            </h2>
            {draftShown ? <TableChip dot tone="warning" value="чернетка, не збережена" /> : <TableChip tone="neutral" value="збережена версія" />}
          </div>
          <div className="content-preview-sheet">
            <p className="content-preview-title">{title || 'Без заголовка'}</p>
            {lead ? <p className="content-preview-lead">{lead}</p> : null}
            {draftShown ? (
              <>
                <iframe className="content-preview-frame" title="Чернетка тексту сторінки" sandbox="" srcDoc={previewDocument(draft)} />
                <p className="content-preview-help">Після збереження сервер прибере недозволену розмітку, і тут з&apos;явиться збережена версія.</p>
              </>
            ) : saved.bodyHtml ? (
              <div className="content-prose" dangerouslySetInnerHTML={{ __html: saved.bodyHtml }} />
            ) : (
              <p className="content-muted">Текст порожній: вітрина покаже заглушку «Текст готує магазин».</p>
            )}
          </div>
        </section>
      </form>
    </div>
  )
}
