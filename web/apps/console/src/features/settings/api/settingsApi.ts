import type { components } from '@polivalko/shared/api/schema'
import { api } from '@/shared/api/client'
import type { CsrfHeaders } from '@/shared/api/csrf'

type S = components['schemas']

export type Contacts = S['ContactsDto']
export type PickupPoint = S['ConsolePickupPointDto']
export type UpdatePickupPointRequest = S['UpdatePickupPointRequest']
export type ShopSettings = S['ShopSettingsDto']
export type Seller = S['ShopSellerDto']
export type SpecialDay = S['ShopSpecialDayDto']
export type DeliverySettings = S['DeliverySettingsDto']
export type PaymentSettings = S['PaymentSettingsDto']
export type NotificationSettings = S['NotificationSettingsDto']
export type NotificationEvents = S['NotificationEventsDto']
export type SaveNotificationSettingsRequest = S['SaveNotificationSettingsRequest']

export function getContacts() {
  return api.GET('/api/v1/console/content/contacts')
}

export function saveContacts(headers: CsrfHeaders, body: Contacts) {
  return api.PUT('/api/v1/console/content/contacts', { headers, body })
}

export function getShopSettings() {
  return api.GET('/api/v1/console/settings/shop')
}

export function saveShopSettings(headers: CsrfHeaders, body: ShopSettings) {
  return api.PUT('/api/v1/console/settings/shop', { headers, body })
}

export function getDeliverySettings() {
  return api.GET('/api/v1/console/settings/delivery')
}

export function saveDeliverySettings(headers: CsrfHeaders, body: DeliverySettings) {
  return api.PUT('/api/v1/console/settings/delivery', { headers, body })
}

export function getPickupPoints() {
  return api.GET('/api/v1/console/delivery/pickup-points')
}

export function savePickupPoint(headers: CsrfHeaders, code: string, body: UpdatePickupPointRequest) {
  return api.PUT('/api/v1/console/delivery/pickup-points/{code}', { params: { path: { code } }, headers, body })
}

export function getPaymentSettings() {
  return api.GET('/api/v1/console/settings/payments')
}

export function getNotificationSettings() {
  return api.GET('/api/v1/console/settings/notifications')
}

export function saveNotificationSettings(headers: CsrfHeaders, body: SaveNotificationSettingsRequest) {
  return api.PUT('/api/v1/console/settings/notifications', { headers, body })
}

export function sendTestNotification(headers: CsrfHeaders) {
  return api.POST('/api/v1/console/settings/notifications/test', { headers })
}
