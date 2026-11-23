import { IconArrowUpRight } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { numberFormat } from '../lib/insights'

type QueueTileProps = {
  count?: number
  label: string
  href?: string
  hot: boolean
  busy?: boolean
}

export function QueueTile({ count, label, href, hot, busy }: QueueTileProps) {
  const className = `dash-queue-item${hot && (count ?? 0) > 0 ? ' is-hot' : ''}`
  const content = (
    <>
      <span className="dash-queue-label">{label}</span>
      {busy && count == null
        ? <span className="dash-shimmer dash-queue-count-placeholder" role="status" aria-label="Завантаження кількості" />
        : <strong>{count == null ? '—' : numberFormat.format(count)}</strong>}
      {href && <IconArrowUpRight className="dash-queue-arrow" size={18} stroke={1.6} aria-hidden="true" />}
    </>
  )
  return (
    <li>
      {href ? (
        <Link to={href} className={className} aria-busy={busy || undefined}>{content}</Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  )
}
