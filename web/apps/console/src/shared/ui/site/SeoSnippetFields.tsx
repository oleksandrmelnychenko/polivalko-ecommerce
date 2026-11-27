import { Stack, Text, Textarea, TextInput } from '@mantine/core'
import { siteUrl } from '@/shared/lib/siteUrl'
import { SnippetLength } from './SnippetLength'
import './seo-snippet.css'

const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 160
const SHOP_SUFFIX = ' | Poli Valko'
const HAS_SHOP_NAME = /poli\s*valko[\s.!?»"')]*$/i

function withShopSuffix(title: string): string {
  const clean = title.trim() || 'Без заголовка'
  return HAS_SHOP_NAME.test(clean) ? clean : `${clean}${SHOP_SUFFIX}`
}

type SeoSnippetFieldsProps = {
  /** Address on the shop, e.g. `/product/<slug>`. */
  path: string
  seoTitle: string
  seoDescription: string
  /** What the shop shows when the title is empty (roughly: the template fills in the details). */
  fallbackTitle: string
  fallbackDescription: string
  /** What fills empty fields on this page; the default is the SEO templates of products and categories. */
  emptyHints?: EmptyHints
  errors?: { seoTitle?: string; seoDescription?: string }
  disabled?: boolean
  onChange: (field: 'seoTitle' | 'seoDescription', value: string) => void
}

export type EmptyHints = { title: string; description: string; note: string }

const TEMPLATE_HINTS: EmptyHints = {
  title: 'Порожньо: заголовок складе SEO-шаблон',
  description: 'Порожньо: опис складе SEO-шаблон',
  note: 'Порожні поля сайт заповнює за SEO-шаблоном (Сайт → SEO-шаблони), тож перегляд тут приблизний. Заповнюйте їх, лише коли хочете окремий текст для пошуку.',
}

/**
 * SEO title and description with length counters and a search-result preview. Empty fields are fine:
 * the shop then fills them from the SEO templates (Сайт → SEO-шаблони).
 */
export function SeoSnippetFields({ path, seoTitle, seoDescription, fallbackTitle, fallbackDescription, emptyHints = TEMPLATE_HINTS, errors, disabled, onChange }: SeoSnippetFieldsProps) {
  const ownTitle = seoTitle.trim()
  const ownDescription = seoDescription.trim()
  const shownTitle = withShopSuffix(ownTitle || fallbackTitle)
  const shownDescription = ownDescription || fallbackDescription.trim()

  return (
    <Stack gap="sm">
      <TextInput
        label="SEO-заголовок"
        placeholder={emptyHints.title}
        description={<SnippetLength length={shownTitle.length} target={TITLE_LIMIT} />}
        inputWrapperOrder={['label', 'input', 'description', 'error']}
        value={seoTitle}
        maxLength={200}
        disabled={disabled}
        error={errors?.seoTitle}
        onChange={(event) => onChange('seoTitle', event.currentTarget.value)}
      />
      <Textarea
        label="SEO-опис"
        placeholder={emptyHints.description}
        description={<SnippetLength length={shownDescription.length} target={DESCRIPTION_LIMIT} />}
        inputWrapperOrder={['label', 'input', 'description', 'error']}
        value={seoDescription}
        maxLength={500}
        autosize
        minRows={2}
        disabled={disabled}
        error={errors?.seoDescription}
        onChange={(event) => onChange('seoDescription', event.currentTarget.value)}
      />
      <figure className="seo-snippet" aria-label="Приблизний вигляд у пошуку Google">
        <span className="seo-snippet-site">Poli Valko</span>
        <span className="seo-snippet-url">{siteUrl(path)}</span>
        <span className="seo-snippet-title">{clip(shownTitle, TITLE_LIMIT)}</span>
        <span className="seo-snippet-description">{shownDescription ? clip(shownDescription, DESCRIPTION_LIMIT) : 'Опису немає: Google візьме уривок тексту зі сторінки.'}</span>
      </figure>
      {!ownTitle || !ownDescription ? (
        <Text size="xs" c="dimmed">
          {emptyHints.note}
        </Text>
      ) : null}
    </Stack>
  )
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
}
