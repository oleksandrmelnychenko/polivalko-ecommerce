import type { components } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import type { CsrfHeaders } from '@/shared/api/csrf'
import { postForm } from './request'

type S = components['schemas']

export type AttributeKind = S['AttributeKind']
export type AttributeFilterView = S['AttributeFilterView']
export type AttributeDefinition = S['AttributeDefinitionDto']
export type SaveAttributeRequest = S['SaveAttributeDefinitionRequest']
export type AttributeDetails = S['AttributeDetailsDto']
export type Brand = S['BrandDto']
export type SaveBrandRequest = S['SaveBrandRequest']
export type LabelTone = S['LabelTone']
export type LabelKind = S['LabelKind']
export type ProductLabel = S['LabelDto']
export type SaveLabelRequest = S['SaveLabelRequest']
export type MediaImage = S['UploadedImageDto']

export function getAttributes() {
  return api.GET('/api/v1/console/catalog/attributes')
}

export function saveAttribute(headers: CsrfHeaders, id: string | null, body: SaveAttributeRequest) {
  return id
    ? api.PUT('/api/v1/console/catalog/attributes/{id}', { params: { path: { id } }, headers, body })
    : api.POST('/api/v1/console/catalog/attributes', { headers, body })
}

export function deleteAttribute(headers: CsrfHeaders, id: string) {
  return api.DELETE('/api/v1/console/catalog/attributes/{id}', { params: { path: { id } }, headers })
}

export function getAttributeDetails(id: string) {
  return api.GET('/api/v1/console/catalog/attributes/{id}/details', { params: { path: { id } } })
}

export function getBrands() {
  return api.GET('/api/v1/console/catalog/brands')
}

export function saveBrand(headers: CsrfHeaders, id: string | null, body: SaveBrandRequest) {
  return id
    ? api.PUT('/api/v1/console/catalog/brands/{id}', { params: { path: { id } }, headers, body })
    : api.POST('/api/v1/console/catalog/brands', { headers, body })
}

export function deleteBrand(headers: CsrfHeaders, id: string) {
  return api.DELETE('/api/v1/console/catalog/brands/{id}', { params: { path: { id } }, headers })
}

export function mergeBrand(headers: CsrfHeaders, id: string, intoId: string) {
  return api.POST('/api/v1/console/catalog/brands/{id}/merge', { params: { path: { id } }, headers, body: { intoId } })
}

export function getLabels() {
  return api.GET('/api/v1/console/catalog/labels')
}

export function saveLabel(headers: CsrfHeaders, id: string | null, body: SaveLabelRequest) {
  return id
    ? api.PUT('/api/v1/console/catalog/labels/{id}', { params: { path: { id } }, headers, body })
    : api.POST('/api/v1/console/catalog/labels', { headers, body })
}

export function deleteLabel(headers: CsrfHeaders, id: string) {
  return api.DELETE('/api/v1/console/catalog/labels/{id}', { params: { path: { id } }, headers })
}

export function uploadMediaImage(file: File) {
  const data = new FormData()
  data.set('file', file)
  return postForm<MediaImage>('/api/v1/console/media/images', data)
}
