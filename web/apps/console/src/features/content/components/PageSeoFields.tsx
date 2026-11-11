import { Stack, Textarea, TextInput } from '@mantine/core'
import { siteUrl } from '@/shared/lib/siteUrl'

const SEO_TITLE_LIMIT = 60
const SEO_DESCRIPTION_LIMIT = 160
const SHOP_SUFFIX = ' | Poli Valko'

type PageSeoFieldsProps = {
  slug: string
  title: string
  lead: string
  seoTitle: string
  seoDescription: string
  errors: Record<string, string>
  onChange: (field: 'seoTitle' | 'seoDescription', value: string) => void
}

export function PageSeoFields({ slug, title, lead, seoTitle, seoDescription, errors, onChange }: PageSeoFieldsProps) {
  const shownTitle = `${seoTitle.trim() || title.trim() || 'Без заголовка'}${SHOP_SUFFIX}`
  const description = seoDescription.trim()
  const shownDescription = description || lead.trim()

  return (
    <fieldset className="content-fieldset content-seo">
      <legend className="app-section-title">Пошук (SEO)</legend>
      <Stack gap="sm">
        <TextInput
          label="SEO-заголовок"
          description={
            <>
              Якщо поле порожнє, сайт візьме заголовок сторінки. Сайт додає «{SHOP_SUFFIX.trim()}» у кінці. <Counter length={shownTitle.length} limit={SEO_TITLE_LIMIT} />
            </>
          }
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          value={seoTitle}
          maxLength={200}
          error={errors.seoTitle}
          onChange={(event) => onChange('seoTitle', event.currentTarget.value)}
        />
        <Textarea
          label="SEO-опис"
          description={
            <>
              Текст під заголовком у результатах пошуку. Якщо поле порожнє, сайт візьме підзаголовок сторінки. <Counter length={description.length} limit={SEO_DESCRIPTION_LIMIT} />
            </>
          }
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          value={seoDescription}
          maxLength={500}
          autosize
          minRows={2}
          error={errors.seoDescription}
          onChange={(event) => onChange('seoDescription', event.currentTarget.value)}
        />
        <figure className="content-snippet" aria-label="Приблизний вигляд у пошуку Google">
          <span className="content-snippet-site">Poli Valko</span>
          <span className="content-snippet-url">{siteUrl(`/${slug}`)}</span>
          <span className="content-snippet-title">{clip(shownTitle, SEO_TITLE_LIMIT)}</span>
          <span className="content-snippet-description">{shownDescription ? clip(shownDescription, SEO_DESCRIPTION_LIMIT) : 'Опису немає: Google візьме уривок тексту зі сторінки.'}</span>
        </figure>
      </Stack>
    </fieldset>
  )
}

function Counter({ length, limit }: { length: number; limit: number }) {
  const over = length > limit
  return (
    <span className={`content-length${over ? ' is-over' : ''}`}>
      {length} / {limit}
      {over ? ' · Google обріже' : ''}
    </span>
  )
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
}
