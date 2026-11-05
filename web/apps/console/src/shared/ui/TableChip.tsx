export type TableChipTone = 'neutral' | 'document' | 'product' | 'source' | 'storage' | 'success' | 'warning' | 'danger'

type TableChipProps = {
  value: string | number | null | undefined
  tone?: TableChipTone
  size?: 'md' | 'lg'
  dot?: boolean
  title?: string
}

export function TableChip({ value, tone = 'neutral', size, dot = false, title }: TableChipProps) {
  const text = value == null ? '' : String(value).trim()
  if (!text) return <span>—</span>
  return (
    <span className={`app-table-chip is-${tone}${size ? ` is-size-${size}` : ''}`} title={title ?? text}>
      {dot ? <span className="app-table-chip-dot" aria-hidden="true" /> : null}
      <span className="app-table-chip-label">{text}</span>
    </span>
  )
}
