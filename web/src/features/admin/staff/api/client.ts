import type { CsrfHeaders } from "@/shared/admin/csrf";
import { browserApi } from "@/shared/api/browser";
import type { components } from "@/shared/api/schema";

type S = components["schemas"];

export function getUsers() {
  return browserApi.GET("/api/v1/admin/users");
}

export function createUser(headers: CsrfHeaders, body: S["CreateStaffUserRequest"]) {
  return browserApi.POST("/api/v1/admin/users", { headers, body });
}

export function updateUser(headers: CsrfHeaders, id: string, body: S["UpdateStaffUserRequest"]) {
  return browserApi.PUT("/api/v1/admin/users/{id}", { params: { path: { id } }, headers, body });
}

export function lockUser(headers: CsrfHeaders, id: string, body: S["LockStaffUserRequest"]) {
  return browserApi.POST("/api/v1/admin/users/{id}/lock", { params: { path: { id } }, headers, body });
}

export function resetPassword(headers: CsrfHeaders, id: string, body: S["ResetPasswordRequest"]) {
  return browserApi.POST("/api/v1/admin/users/{id}/password", { params: { path: { id } }, headers, body });
}

export function changeOwnPassword(headers: CsrfHeaders, body: S["ChangeOwnPasswordRequest"]) {
  return browserApi.POST("/api/v1/admin/auth/password", { headers, body });
}
