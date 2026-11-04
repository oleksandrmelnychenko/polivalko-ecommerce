import type { CsrfHeaders, SaveAddressRequest } from "@/features/customer";
import { browserApi } from "@polivalko/shared/api/browser";
import type { components } from "@polivalko/shared/api/schema";

type S = components["schemas"];

export function postConfirmEmail(headers: CsrfHeaders, token: string) {
  return browserApi.POST("/api/v1/account/email/confirm", { headers, body: { token } });
}

export function postResendConfirmation(headers: CsrfHeaders) {
  return browserApi.POST("/api/v1/account/email/resend", { headers });
}

export function postForgotPassword(headers: CsrfHeaders, email: string) {
  return browserApi.POST("/api/v1/account/password/forgot", { headers, body: { email } });
}

export function postResetPassword(headers: CsrfHeaders, body: S["ResetCustomerPasswordRequest"]) {
  return browserApi.POST("/api/v1/account/password/reset", { headers, body });
}

export function putProfile(headers: CsrfHeaders, body: S["UpdateProfileRequest"]) {
  return browserApi.PUT("/api/v1/account/profile", { headers, body });
}

export function postChangePassword(headers: CsrfHeaders, body: S["ChangeCustomerPasswordRequest"]) {
  return browserApi.POST("/api/v1/account/password", { headers, body });
}

export function putAddress(headers: CsrfHeaders, id: string, body: SaveAddressRequest) {
  return browserApi.PUT("/api/v1/account/addresses/{id}", { headers, params: { path: { id } }, body });
}

export function deleteAddress(headers: CsrfHeaders, id: string) {
  return browserApi.DELETE("/api/v1/account/addresses/{id}", { headers, params: { path: { id } } });
}

export function getOrders(page: number) {
  return browserApi.GET("/api/v1/account/orders", { params: { query: { page, pageSize: 10 } } });
}

export function getOrder(number: string) {
  return Promise.all([
    browserApi.GET("/api/v1/account/orders/{number}", { params: { path: { number } } }),
    browserApi.GET("/api/v1/account/orders/{number}/receipts", { params: { path: { number } } }),
  ]);
}

export function postOrderPayment(headers: CsrfHeaders, number: string) {
  return browserApi.POST("/api/v1/account/orders/{number}/payments", { headers, params: { path: { number } } });
}

export function postQuote(items: { productId: string; quantity: number }[]) {
  return browserApi.POST("/api/v1/checkout/quote", { body: { items } });
}
