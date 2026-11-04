import { browserApi } from "@polivalko/shared/api/browser";
import type { components } from "@polivalko/shared/api/schema";
import type { CsrfHeaders } from "../lib/csrf";
import type { SaveAddressRequest } from "../lib/types";

type S = components["schemas"];

export function getMe() {
  return browserApi.GET("/api/v1/account/me");
}

export function postLogin(headers: CsrfHeaders, body: S["CustomerLoginRequest"]) {
  return browserApi.POST("/api/v1/account/login", { headers, body });
}

export function postRegister(headers: CsrfHeaders, body: S["RegisterCustomerRequest"]) {
  return browserApi.POST("/api/v1/account/register", { headers, body });
}

export function postLogout(headers: CsrfHeaders) {
  return browserApi.POST("/api/v1/account/logout", { headers });
}

export function getAddresses() {
  return browserApi.GET("/api/v1/account/addresses");
}

export function postAddress(headers: CsrfHeaders, body: SaveAddressRequest) {
  return browserApi.POST("/api/v1/account/addresses", { headers, body });
}
