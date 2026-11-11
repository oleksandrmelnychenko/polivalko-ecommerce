import { Alert, Button, Skeleton } from '@mantine/core'
import { IconAlertCircle, IconArrowUpRight, IconEyeOff, IconFolder, IconPencil } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { plural } from '@polivalko/shared/lib/format'
import type { ApiQuery } from '@/shared/api/useApiQuery'
import { siteUrl } from '@/shared/lib/siteUrl'
import type { AttributeDefinition, AttributeDetails } from '../api/dictionariesApi'
import { ATTRIBUTE_KIND_LABELS, FILTER_VIEW_LABELS } from '../lib/attributes'

const countFormat = new Intl.NumberFormat('uk-UA')
const percentFormat = new Intl.NumberFormat('uk-UA', { style: 'percent', maximumFractionDigits: 0 })

type AttributeDetailPaneProps = {
  attribute: AttributeDefinition | null
  details: ApiQuery<AttributeDetails>
  totalProducts: number | null
  onEdit: (attribute: AttributeDefinition) => void
}

function share(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return percentFormat.format(0)
  const value = part / whole
  return value < 0.01 ? `<${percentFormat.format(0.01)}` : percentFormat.format(value)
}

export function AttributeDetailPane({ attribute, details, totalProducts, onEdit }: AttributeDetailPaneProps) {
  if (!attribute) return <section className="app-split-detail app-split-detail-empty">Оберіть характеристику зліва.</section>

  const data = details.data?.id === attribute.id ? details.data : null
  const loading = !data && (details.isLoading || details.isFetching)
  const groups = groupCategories(data?.categories ?? [])
  const kind = ATTRIBUTE_KIND_LABELS[attribute.kind] ?? attribute.kind
  const filter = attribute.categoryCount
    ? `фільтр на сайті, ${(FILTER_VIEW_LABELS[attribute.filterView] ?? attribute.filterView).toLowerCase()}`
    : 'не фільтр'

  return (
    <section key={attribute.id} className="app-split-detail" aria-labelledby="attribute-detail-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-hero-main">
            <p className="app-split-hero-kicker">
              {kind} · {filter}
            </p>
            <h2 id="attribute-detail-title">
              {attribute.name}
              {attribute.unit ? <span className="app-split-hero-unit">{attribute.unit}</span> : null}
            </h2>
            {attribute.aliases.length ? <p className="app-split-hero-aliases">Також: {attribute.aliases.join(', ')}</p> : null}
          </div>
          <Button variant="default" size="sm" leftSection={<IconPencil size={16} stroke={1.7} />} onClick={() => onEdit(attribute)}>
            Змінити
          </Button>
        </div>

        <dl className="app-split-stats">
          <div>
            <dt>Товарів</dt>
            <dd>
              {countFormat.format(attribute.productCount)}
              {totalProducts ? <small>{share(attribute.productCount, totalProducts)} каталогу</small> : null}
            </dd>
          </div>
          <div>
            <dt>Значень</dt>
            <dd>{data ? countFormat.format(data.valueCount) : '·'}</dd>
          </div>
          <div>
            <dt>Категорій з фільтром</dt>
            <dd>{countFormat.format(attribute.categoryCount)}</dd>
          </div>
        </dl>

        <section className="app-split-hero-values" aria-labelledby="attribute-values-title">
          <header className="app-split-card-head">
            <h3 id="attribute-values-title">Значення</h3>
            {data && data.valueCount > data.values.length ? (
              <span>
                {data.values.length} найчастіших з {countFormat.format(data.valueCount)}
              </span>
            ) : null}
          </header>

          {loading ? (
            <div className="app-split-tags">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} height={28} width={90 + (index % 3) * 30} radius="xl" />
              ))}
            </div>
          ) : data && data.values.length > 0 ? (
            <ul className="app-split-tags">
              {data.values.map((value) => (
                <li key={value.value} title={`${value.value}: ${countFormat.format(value.productCount)} ${plural(value.productCount, 'товар', 'товари', 'товарів')}`}>
                  <span className="app-split-tag-name">{value.value}</span>
                  <span className="app-split-tag-count">{countFormat.format(value.productCount)}</span>
                </li>
              ))}
            </ul>
          ) : data ? (
            <p className="app-split-blank">У жодного товару ще немає цієї характеристики.</p>
          ) : null}
        </section>
      </header>

      {details.status === 'error' && !data ? (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />} role="alert">
          Не вдалося завантажити значення й категорії.
        </Alert>
      ) : null}

      <section className="app-split-card" aria-labelledby="attribute-categories-title">
        <header className="app-split-card-head">
          <h3 id="attribute-categories-title">Фільтр у категоріях</h3>
          {data && data.categories.length ? (
            <span>
              {data.categories.length} {plural(data.categories.length, 'категорія', 'категорії', 'категорій')} у {groups.length}{' '}
              {plural(groups.length, 'розділі', 'розділах', 'розділах')}
            </span>
          ) : null}
        </header>

        {loading ? (
          <div className="app-split-sections">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} height={84} radius={12} />
            ))}
          </div>
        ) : groups.length > 0 ? (
          <div className="app-split-sections">
            {groups.map((group) => (
              <div key={group.title} className="app-split-section">
                <p className="app-split-section-head">
                  <IconFolder size={16} stroke={1.8} aria-hidden="true" />
                  <span>{group.title}</span>
                  <em>{group.items.length}</em>
                </p>
                <ul className="app-split-tags">
                  {group.items.map((category) =>
                    category.isVisible ? (
                      <li key={category.id} className="is-link">
                        <a href={siteUrl(`/catalog/${category.slug}`)} target="_blank" rel="noopener" title="Відкрити категорію на сайті">
                          <span className="app-split-tag-name">{category.name}</span>
                          <IconArrowUpRight size={13} stroke={2} aria-hidden="true" />
                        </a>
                      </li>
                    ) : (
                      <li key={category.id} className="is-hidden" title="Категорія прихована на сайті">
                        <IconEyeOff size={13} stroke={1.8} aria-hidden="true" />
                        <span className="app-split-tag-name">{category.name}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        ) : data ? (
          <p className="app-split-blank">
            Жодна категорія не показує її у фільтрах. Додати можна в <Link to="/catalog/categories">категоріях</Link>.
          </p>
        ) : null}
      </section>
    </section>
  )
}

type CategoryItem = AttributeDetails['categories'][number]

function groupCategories(categories: readonly CategoryItem[]): { title: string; items: CategoryItem[] }[] {
  const groups = new Map<string, CategoryItem[]>()
  for (const category of categories) {
    const title = category.parentName ?? 'Розділи каталогу'
    groups.set(title, [...(groups.get(title) ?? []), category])
  }
  return [...groups.entries()].map(([title, items]) => ({ title, items }))
}
