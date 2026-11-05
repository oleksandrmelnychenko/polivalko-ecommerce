export const PAGE_SIZE_OPTIONS = [20, 40, 60, 100] as const
export const DEFAULT_PAGE_SIZE = 20

export function normalizePageSize(value: string | number | null | undefined): number {
  const size = Number(value)
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE
}
