import type { components } from '@polivalko/shared/api/schema'
import { api } from '../api/client'
import type { CsrfHeaders } from '../api/csrf'

type S = components['schemas']

export type PermissionCatalog = S['PermissionCatalogDto']
export type PermissionDefinition = S['PermissionDefinitionDto']
export type PermissionRisk = S['PermissionRisk']
export type MyPermissions = S['MyPermissionsDto']
export type StaffRole = S['StaffRoleDto']
export type SaveStaffRoleRequest = S['SaveStaffRoleRequest']
export type RolePermissions = S['RolePermissionsDto']
export type UpdateRolePermissionsRequest = S['UpdateRolePermissionsRequest']
export type StaffMe = S['StaffMeDto']

export function getPermissionCatalog() {
  return api.GET('/api/v1/console/permissions/catalog')
}

export function getMyPermissions() {
  return api.GET('/api/v1/console/permissions/me')
}

export function getRoles() {
  return api.GET('/api/v1/console/roles')
}

export function createRole(headers: CsrfHeaders, body: SaveStaffRoleRequest) {
  return api.POST('/api/v1/console/roles', { headers, body })
}

export function updateRole(headers: CsrfHeaders, id: string, body: SaveStaffRoleRequest) {
  return api.PUT('/api/v1/console/roles/{id}', { params: { path: { id } }, headers, body })
}

export function deleteRole(headers: CsrfHeaders, id: string) {
  return api.DELETE('/api/v1/console/roles/{id}', { params: { path: { id } }, headers })
}

export function getRolePermissions(id: string) {
  return api.GET('/api/v1/console/roles/{id}/permissions', { params: { path: { id } } })
}

export function updateRolePermissions(headers: CsrfHeaders, id: string, body: UpdateRolePermissionsRequest) {
  return api.PUT('/api/v1/console/roles/{id}/permissions', { params: { path: { id } }, headers, body })
}
