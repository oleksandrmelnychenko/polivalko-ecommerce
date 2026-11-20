import { SEO_LIMITS } from '../lib/seoTemplates'

type SnippetPreviewProps = {
  title: string
  description: string
  url: string
}

export function SnippetPreview({ title, description, url }: SnippetPreviewProps) {
  return (
    <figure className="site-snippet" aria-label="Приблизний вигляд у пошуку Google">
      <span className="site-snippet-site">Poli Valko</span>
      <span className="site-snippet-url">{url}</span>
      <span className="site-snippet-title">{clip(title, SEO_LIMITS.title) || 'Без заголовка'}</span>
      <span className="site-snippet-description">{description ? clip(description, SEO_LIMITS.description) : 'Опису немає: Google візьме уривок тексту зі сторінки.'}</span>
    </figure>
  )
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
}
