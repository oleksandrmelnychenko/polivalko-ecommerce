function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/[\s-]+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

export function BrandMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <span className="catalog-brand-mark" aria-hidden="true">
      {logoUrl ? <img src={logoUrl} alt="" loading="lazy" /> : initials(name)}
    </span>
  )
}
