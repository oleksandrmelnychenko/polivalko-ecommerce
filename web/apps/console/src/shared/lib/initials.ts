export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((word) => word.match(/\p{L}/u)?.[0] ?? '')
    .filter(Boolean)
  return letters.slice(0, 2).join('').toLocaleUpperCase('uk') || '?'
}
