import type { Product } from '../api/catalogApi'

export function withUniqueImages(product: Product): Product {
  const seen = new Set<string>()
  const images = product.images.filter((image) => !seen.has(image.id) && seen.add(image.id))
  return images.length === product.images.length ? product : { ...product, images }
}
