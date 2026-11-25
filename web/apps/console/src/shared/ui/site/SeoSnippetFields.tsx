import { Stack, Text, Textarea, TextInput } from '@mantine/core'
import { siteUrl } from '@/shared/lib/siteUrl'
import { SnippetLength } from './SnippetLength'
import './seo-snippet.css'

const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 160
const SHOP_SUFFIX = ' | Poli Valko'

type SeoSnippetFieldsProps = {
  /** Address on the shop, e.g. `/product/<slug>`. */
  path: string
  seoTitle: string
  seoDescription: string
  /** What the shop shows when the title is empty (roughly: the template fills in the details). */
  fallbackTitle: string
  fallbackDescription: string
  errors?: { seoTitle?: string; seoDescription?: string }
  disabled?: boolean
  onChange: (field: 'seoTitle' | 'seoDescription', value: string) => void
}

/**
 * SEO title and description with length counters and a search-result preview. Empty fields are fine:
 * the shop then fills them from the SEO templates (Сайт → SEO-шаблони).
 */
export function SeoSnippetFields({ path, seoTitle, seoDescription, fallbackTitle, fallbackDescription, errors, disabled, onChange }: SeoSnippetFieldsProps) {
  const ownTitle = seoTitle.trim()
  const ownDescription = seoDescription.trim()
  const shownTitle = `${ownTitle || fallbackTitle.trim() || 'Без заголовка'}${SHOP_SUFFIX}`
  const shownDescription = ownDescription || fallbackDescription.trim()

  return (
    <Stack gap="sm">
      <TextInput
        label="SEO-заголовок"
        placeholder="Порожньо: заголовок складе SEO-шаблон"
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
        placeholder="Порожньо: опис складе SEO-шаблон"
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
          Порожні поля сайт заповнює за SEO-шаблоном (Сайт → SEO-шаблони), тож перегляд тут приблизний. Заповнюйте їх, лише коли хочете окремий текст для пошуку.
        </Text>
      ) : null}
    </Stack>
  )
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
}
