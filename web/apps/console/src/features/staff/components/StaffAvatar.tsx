function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((word) => word.match(/\p{L}/u)?.[0] ?? '')
    .filter(Boolean)
  return letters.slice(0, 2).join('').toLocaleUpperCase('uk') || '?'
}

type StaffAvatarProps = {
  name: string
  size: 'sm' | 'lg'
  locked?: boolean
}

export function StaffAvatar({ name, size, locked = false }: StaffAvatarProps) {
  return (
    <span className={`staff-avatar is-${size}${locked ? ' is-locked' : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
