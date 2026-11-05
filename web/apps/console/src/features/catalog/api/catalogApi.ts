import type { components, paths } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import type { CsrfHeaders } from '@/shared/api/csrf'
import { postForm } from './request'

export type { UploadResult } from './request'

type S = components['schemas']

export type ProductLabelRef = S['ConsoleProductLabelDto']

export type ProductFill = 'missing-photo' | 'missing-description' | 'missing-attributes' | 'any-missing'

export type ProductsQuery = NonNullable<paths['/api/v1/console/catalog/products']['get']['parameters']['query']>
export type ProductRow = S['ConsoleProductListItemDto']
export type Product = S['ConsoleProductDto']
export type ProductImage = S['ConsoleProductImageDto']
export type ProductAttribute = S['ProductAttributeDto']
export type UpdateProductRequest = S['UpdateProductRequest']
export type ConsoleCategory = S['ConsoleCategoryDto']
export type SaveCategoryRequest = S['SaveCategoryRequest']
export type ConsoleCollection = S['ConsoleCollectionDto']
export type SaveCollectionRequest = S['SaveCollectionRequest']
export type ImportRun = S['ImportRunDto']
export type AttributeName = S['AttributeNameDto']

export type ProductCounts = S['ConsoleProductCountsDto']
export type BulkProductsRequest = S['BulkUpdateProductsRequest']

export function getProducts(query: ProductsQuery) {
  return api.GET('/api/v1/console/catalog/products', { params: { query } })
}

export function getProductCounts() {
  return api.GET('/api/v1/console/catalog/products/counts')
}

export function bulkUpdateProducts(headers: CsrfHeaders, body: BulkProductsRequest) {
  return api.POST('/api/v1/console/catalog/products/bulk', { headers, body })
}

export function setProductsVisibility(headers: CsrfHeaders, body: S['SetProductsVisibilityRequest']) {
  return api.POST('/api/v1/console/catalog/products/visibility', { headers, body })
}

export function getProduct(id: string) {
  return api.GET('/api/v1/console/catalog/products/{id}', { params: { path: { id } } })
}

export function updateProduct(headers: CsrfHeaders, id: string, body: UpdateProductRequest) {
  return api.PUT('/api/v1/console/catalog/products/{id}', { params: { path: { id } }, headers, body })
}

export function reorderImages(headers: CsrfHeaders, id: string, images: S['ProductImageOrderItem'][]) {
  return api.PUT('/api/v1/console/catalog/products/{id}/images', { params: { path: { id } }, headers, body: { images } })
}

export function deleteImage(headers: CsrfHeaders, id: string, imageId: string) {
  return api.DELETE('/api/v1/console/catalog/products/{id}/images/{imageId}', { params: { path: { id, imageId } }, headers })
}

export function getAttributeNames(categoryId: string | undefined) {
  return api.GET('/api/v1/console/catalog/attribute-names', { params: { query: { categoryId } } })
}

export function getCategories() {
  return api.GET('/api/v1/console/catalog/categories')
}

export function saveCategory(headers: CsrfHeaders, id: string | null, body: SaveCategoryRequest) {
  return id
    ? api.PUT('/api/v1/console/catalog/categories/{id}', { params: { path: { id } }, headers, body })
    : api.POST('/api/v1/console/catalog/categories', { headers, body })
}

export function deleteCategory(headers: CsrfHeaders, id: string) {
  return api.DELETE('/api/v1/console/catalog/categories/{id}', { params: { path: { id } }, headers })
}

export function getCollections() {
  return api.GET('/api/v1/console/catalog/collections')
}

export function saveCollection(headers: CsrfHeaders, id: string | null, body: SaveCollectionRequest) {
  return id
    ? api.PUT('/api/v1/console/catalog/collections/{id}', { params: { path: { id } }, headers, body })
    : api.POST('/api/v1/console/catalog/collections', { headers, body })
}

export function deleteCollection(headers: CsrfHeaders, id: string) {
  return api.DELETE('/api/v1/console/catalog/collections/{id}', { params: { path: { id } }, headers })
}




export function getImportRuns() {
  return api.GET('/api/v1/console/integration/runs', { params: { query: { job: 'navkolo.import' } } })
}

export function uploadProductImage(id: string, data: FormData) {
  return postForm<Product>(`/api/v1/console/catalog/products/${encodeURIComponent(id)}/images`, data)
}

export function importCatalog(data: FormData) {
  return postForm<ImportRun>('/api/v1/console/integration/navkolo/import', data)
}
