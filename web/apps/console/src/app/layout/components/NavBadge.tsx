import type { NavBadgeTone } from '@/features/navigation'

export function NavBadge({ count, tone = 'hot', label }: { count: number; tone?: NavBadgeTone; label?: string }) {
  if (count <= 0) return null
  return (
    <span className={`console-nav-badge is-${tone}`} aria-label={label ? `${label}: ${count}` : String(count)}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
