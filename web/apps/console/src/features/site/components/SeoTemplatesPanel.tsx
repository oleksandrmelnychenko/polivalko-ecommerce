import { Button, Stack } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useRef, useState, type FormEvent } from 'react'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { siteUrl } from '@/shared/lib/siteUrl'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getSeoTemplates, saveSeoTemplates, type SeoTemplate, type SeoTemplates } from '../api/siteApi'
import {
  CATEGORY_SAMPLE,
  CATEGORY_TOKENS,
  normalizeTemplates,
  PRODUCT_SAMPLE,
  PRODUCT_TOKENS,
  renderTemplate,
  SEO_LIMITS,
  trimTemplates,
  validateTemplates,
  type TemplateToken,
} from '../lib/seoTemplates'
import { fieldError, useSaveForm, type FieldErrors } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { SectionCard } from './SectionCard'
import { SnippetPreview } from './SnippetPreview'
import { TemplateField } from './TemplateField'

const FORM_ID = 'site-seo-templates'
const TITLE = 'Мета-шаблони'

export function SeoTemplatesPanel() {
  const templates = useApiQuery('site-seo-templates', () => getSeoTemplates())

  if (templates.status === 'ready' && templates.data) return <SeoTemplatesForm initial={normalizeTemplates(templates.data)} onSaved={templates.setData} />

  return (
    <>
      <PageHeader title={TITLE} />
      {templates.status === 'error' || templates.status === 'forbidden' ? (
        <PageState
          kind={templates.status}
          description={problemMessage(templates.problem, 'Перевірте, що API працює, і спробуйте ще раз.')}
          onRetry={templates.status === 'error' ? templates.reload : undefined}
        />
      ) : (
        <PageState kind="loading" />
      )}
    </>
  )
}

type Entity = keyof SeoTemplates

const ENTITIES: { key: Entity; title: string; description: string; tokens: TemplateToken[]; sample: Record<TemplateToken, string>; url: string }[] = [
  {
    key: 'product',
    title: 'Товари',
    description: 'Для товарів без власного SEO-заголовка чи опису. Порожня змінна (наприклад, бренд) просто випадає з тексту.',
    tokens: PRODUCT_TOKENS,
    sample: PRODUCT_SAMPLE,
    url: siteUrl('/product/shlang-gardena-20m'),
  },
  {
    key: 'category',
    title: 'Категорії',
    description: 'Для категорій без власного SEO-заголовка чи опису.',
    tokens: CATEGORY_TOKENS,
    sample: CATEGORY_SAMPLE,
    url: siteUrl('/catalog/avtopoliv'),
  },
]

function SeoTemplatesForm({ initial, onSaved }: { initial: SeoTemplates; onSaved: (value: SeoTemplates) => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const form = useSaveForm(formRef)
  const [values, setValues] = useState(initial)
  const [saved, setSaved] = useState(() => JSON.stringify(trimTemplates(initial)))
  const dirty = JSON.stringify(trimTemplates(values)) !== saved

  function change(entity: Entity, field: keyof SeoTemplate, value: string) {
    setValues((current) => ({ ...current, [entity]: { ...current[entity], [field]: value } }))
    form.clearField(entity, field)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.busy || !dirty) return
    const body = trimTemplates(values)
    const errors = validateTemplates(body)
    if (Object.keys(errors).length > 0) {
      form.invalid(errors)
      return
    }
    const result = await form.submit((headers) => saveSeoTemplates(headers, body), { done: 'Мета-шаблони збережено.', failed: 'Мета-шаблони не збережено.' })
    if (!result) return
    const next = normalizeTemplates(result.data ?? body)
    setValues(next)
    setSaved(JSON.stringify(trimTemplates(next)))
    onSaved(next)
  }

  return (
    <>
      <PageHeader
        title={TITLE}
        actions={
          <Button type="submit" form={FORM_ID} loading={form.busy} disabled={!dirty} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
            Зберегти
          </Button>
        }
      />
      <div className="site-scroll">
        <form id={FORM_ID} ref={formRef} className="site-form" onSubmit={onSubmit} noValidate aria-label="Мета-шаблони">
          <Stack gap="lg">
            <p className="site-lead">
              Шаблон заповнює заголовок і опис сторінки для пошукових систем, коли в товару чи категорії ці поля порожні. Заповнене вручну шаблон не
              змінює. Натисніть змінну під полем, щоб вставити її в місце курсора.
            </p>
            <FormAlert error={form.error} />
            {ENTITIES.map((entity) => (
              <EntityCard key={entity.key} entity={entity} value={values[entity.key]} errors={form.errors} onChange={(field, value) => change(entity.key, field, value)} />
            ))}
          </Stack>
        </form>
      </div>
    </>
  )
}

type EntityCardProps = {
  entity: (typeof ENTITIES)[number]
  value: SeoTemplate
  errors: FieldErrors
  onChange: (field: keyof SeoTemplate, value: string) => void
}

function EntityCard({ entity, value, errors, onChange }: EntityCardProps) {
  const title = renderTemplate(value.title, entity.sample)
  const description = renderTemplate(value.description, entity.sample)
  return (
    <SectionCard title={entity.title} description={entity.description}>
      <div className="site-template-grid">
        <Stack gap="md">
          <TemplateField
            label="Заголовок (title)"
            value={value.title}
            example={title}
            limit={SEO_LIMITS.title}
            tokens={entity.tokens}
            required
            error={fieldError(errors, entity.key, 'title')}
            onChange={(next) => onChange('title', next)}
          />
          <TemplateField
            label="Опис (description)"
            value={value.description}
            example={description}
            limit={SEO_LIMITS.description}
            tokens={entity.tokens}
            multiline
            error={fieldError(errors, entity.key, 'description')}
            onChange={(next) => onChange('description', next)}
          />
        </Stack>
        <div className="site-template-preview">
          <span className="site-preview-label">Приклад у пошуку</span>
          <SnippetPreview title={title} description={description} url={entity.url} />
        </div>
      </div>
    </SectionCard>
  )
}
