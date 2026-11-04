import { csrfHeader, forgetCsrf } from "@/shared/csrf";
import { browserApi } from "@polivalko/shared/api/browser";
import type { components } from "@polivalko/shared/api/schema";

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
