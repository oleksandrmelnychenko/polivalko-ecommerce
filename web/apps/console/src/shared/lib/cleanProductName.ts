export function cleanProductName(name: string): string {
  return name.trim().replace(/^[\s/]+/, '')
}
