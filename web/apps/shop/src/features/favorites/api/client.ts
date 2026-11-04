import type { CsrfHeaders } from "@/features/customer";
import { browserApi } from "@polivalko/shared/api/browser";

export function getFavoriteIds() {
  return browserApi.GET("/api/v1/account/favorites/ids");
}

export function getFavoriteProducts() {
  return browserApi.GET("/api/v1/account/favorites");
}

export function putFavorite(headers: CsrfHeaders, productId: string) {
  return browserApi.PUT("/api/v1/account/favorites/{productId}", { headers, params: { path: { productId } } });
}

export function deleteFavorite(headers: CsrfHeaders, productId: string) {
  return browserApi.DELETE("/api/v1/account/favorites/{productId}", { headers, params: { path: { productId } } });
}
