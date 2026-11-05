import type { SeoTemplates } from '../api/siteApi'

export type TemplateToken = 'name' | 'price' | 'category' | 'brand' | 'shop'

export const TOKEN_LABELS: Record<TemplateToken, string> = {
  name: 'назва',
  price: 'ціна',
  category: 'категорія',
  brand: 'бренд',
  shop: 'магазин',
}

export const PRODUCT_TOKENS: TemplateToken[] = ['name', 'price', 'category', 'brand', 'shop']
export const CATEGORY_TOKENS: TemplateToken[] = ['name', 'category', 'shop']

export const SEO_LIMITS = { title: 60, description: 160, maxLength: 300 } as const

export const PRODUCT_SAMPLE: Record<TemplateToken, string> = {
  name: 'Шланг поливальний Gardena 1/2", 20 м',
  price: '1 249',
  category: 'Шланги й котушки',
  brand: 'Gardena',
  shop: 'Poli Valko',
}

export const CATEGORY_SAMPLE: Record<TemplateToken, string> = {
  name: 'Автополив',
  price: '',
  category: 'Полив',
  brand: '',
  shop: 'Poli Valko',
}

const TOKEN = /\{([^{}]*)\}/g

export function renderTemplate(template: string, sample: Record<TemplateToken, string>): string {
  return template
    .replace(TOKEN, (match, key: string) => (key in sample ? sample[key as TemplateToken] : match))
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function unknownTokens(template: string, allowed: TemplateToken[]): string[] {
  const found = [...template.matchAll(TOKEN)].map((match) => match[1])
  return [...new Set(found.filter((key) => !allowed.includes(key as TemplateToken)))].map((key) => `{${key}}`)
}

export function validateTemplates(value: SeoTemplates): Record<string, string> {
  const errors: Record<string, string> = {}
  const check = (field: string, template: string, allowed: TemplateToken[], required: boolean) => {
    if (required && !template.trim()) {
      errors[field] = 'Вкажіть шаблон.'
      return
    }
    const unknown = unknownTokens(template, allowed)
    if (unknown.length > 0) errors[field] = `Невідомі змінні: ${unknown.join(', ')}.`
  }
  check('product.title', value.product.title, PRODUCT_TOKENS, true)
  check('product.description', value.product.description, PRODUCT_TOKENS, false)
  check('category.title', value.category.title, CATEGORY_TOKENS, true)
  check('category.description', value.category.description, CATEGORY_TOKENS, false)
  return errors
}

export function normalizeTemplates(value: Partial<SeoTemplates> | undefined): SeoTemplates {
  return {
    product: { title: value?.product?.title ?? '', description: value?.product?.description ?? '' },
    category: { title: value?.category?.title ?? '', description: value?.category?.description ?? '' },
  }
}

export function trimTemplates(value: SeoTemplates): SeoTemplates {
  return {
    product: { title: value.product.title.trim(), description: value.product.description.trim() },
    category: { title: value.category.title.trim(), description: value.category.description.trim() },
  }
}
