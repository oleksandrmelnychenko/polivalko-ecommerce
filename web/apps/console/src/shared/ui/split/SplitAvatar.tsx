import { initials } from '@/shared/lib/initials'

type SplitAvatarProps = {
  name: string
  size: 'sm' | 'lg'
  muted?: boolean
}

export function SplitAvatar({ name, size, muted = false }: SplitAvatarProps) {
  return (
    <span className={`app-split-avatar is-${size}${muted ? ' is-muted' : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
