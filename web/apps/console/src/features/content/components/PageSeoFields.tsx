import { Stack, Textarea, TextInput } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { SnippetLength } from '@/shared/ui/site/SnippetLength'
import { siteUrl } from '@/shared/lib/siteUrl'

const SEO_TITLE_LIMIT = 60
const SEO_DESCRIPTION_LIMIT = 160
const SHOP_SUFFIX = ' | Poli Valko'
const HAS_SHOP_NAME = /poli\s*valko[\s.!?»"')]*$/i

function withShopSuffix(title: string): string {
  const clean = title.trim() || 'Без заголовка'
  return HAS_SHOP_NAME.test(clean) ? clean : `${clean}${SHOP_SUFFIX}`
}

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
  const shownTitle = withShopSuffix(seoTitle.trim() || title)
  const description = seoDescription.trim()
  const shownDescription = description || lead.trim()

  return (
    <fieldset className="content-fieldset content-seo">
      <legend><MetricLabel icon={IconSearch}>Пошук (SEO)</MetricLabel></legend>
      <Stack gap="sm">
        <TextInput
          label="SEO-заголовок"
          placeholder={title}
          description={<SnippetLength length={shownTitle.length} target={SEO_TITLE_LIMIT} />}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          value={seoTitle}
          maxLength={200}
          error={errors.seoTitle}
          onChange={(event) => onChange('seoTitle', event.currentTarget.value)}
        />
        <Textarea
          label="SEO-опис"
          placeholder={lead}
          description={<SnippetLength length={shownDescription.length} target={SEO_DESCRIPTION_LIMIT} />}
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

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
}
