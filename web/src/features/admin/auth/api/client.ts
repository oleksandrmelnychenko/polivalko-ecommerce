import { csrfHeader, forgetCsrf } from "@/shared/admin/csrf";
import { browserApi } from "@/shared/api/browser";
import type { components } from "@/shared/api/schema";

export function getMe() {
  return browserApi.GET("/api/v1/console/auth/me");
}

export function login(body: components["schemas"]["LoginRequest"]) {
  return browserApi.POST("/api/v1/console/auth/login", { body });
}

export async function logout() {
  await browserApi.POST("/api/v1/console/auth/logout", { headers: await csrfHeader() });
  forgetCsrf();
}
