import type { components } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import type { CsrfHeaders } from '@/shared/api/csrf'
import { postFile } from './http'

type S = components['schemas']

export type HomeBlockKey = 'hero' | 'categories' | 'collections' | 'offers' | 'perks' | 'services' | 'steps' | 'visit'
export type HomeSettings = S['HomeSettingsDto']
export type HomeBlock = S['HomeBlockDto']
export type HomeItem = S['HomeItemDto']
export type Announcement = S['HomeAnnouncementDto']
export type Banner = S['BannerDto']
export type SaveBannerRequest = S['SaveBannerRequest']
export type SeoTemplates = S['SeoTemplatesDto']
export type SeoTemplate = S['SeoTemplateDto']
export type UploadedImage = S['UploadedImageDto']
export type ConsoleRedirect = S['ConsoleRedirectDto']

export function getHome() {
  return api.GET('/api/v1/console/site/home')
}

export function saveHome(headers: CsrfHeaders, body: HomeSettings) {
  return api.PUT('/api/v1/console/site/home', { headers, body })
}

export function getBanners() {
  return api.GET('/api/v1/console/site/banners')
}

export function saveBanner(headers: CsrfHeaders, id: string | null, body: SaveBannerRequest) {
  return id
    ? api.PUT('/api/v1/console/site/banners/{id}', { params: { path: { id } }, headers, body })
    : api.POST('/api/v1/console/site/banners', { headers, body })
}

export function deleteBanner(headers: CsrfHeaders, id: string) {
  return api.DELETE('/api/v1/console/site/banners/{id}', { params: { path: { id } }, headers })
}

export function reorderBanners(headers: CsrfHeaders, ids: string[]) {
  return api.PUT('/api/v1/console/site/banners/order', { headers, body: { ids } })
}

export function getSeoTemplates() {
  return api.GET('/api/v1/console/site/seo-templates')
}

export function saveSeoTemplates(headers: CsrfHeaders, body: SeoTemplates) {
  return api.PUT('/api/v1/console/site/seo-templates', { headers, body })
}

export function uploadImage(file: File) {
  return postFile<UploadedImage>('/api/v1/console/media/images', file)
}

export function getRedirects() {
  return api.GET('/api/v1/console/catalog/redirects')
}

export function createRedirect(headers: CsrfHeaders, body: S['CreateRedirectRequest']) {
  return api.POST('/api/v1/console/catalog/redirects', { headers, body })
}

export function deleteRedirect(headers: CsrfHeaders, id: string) {
  return api.DELETE('/api/v1/console/catalog/redirects/{id}', { params: { path: { id } }, headers })
}
