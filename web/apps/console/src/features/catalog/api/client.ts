import { csrfHeader, forgetCsrf, type CsrfHeaders } from "@/shared/csrf";
import { browserApi } from "@polivalko/shared/api/browser";
import type { Problem } from "@polivalko/shared/api/problem";
import type { components, paths } from "@polivalko/shared/api/schema";

type S = components["schemas"];
type ProductsQuery = NonNullable<paths["/api/v1/console/catalog/products"]["get"]["parameters"]["query"]>;

export function getCategoryTree() {
  return browserApi.GET("/api/v1/categories");
}

export function getProducts(query: ProductsQuery) {
  return browserApi.GET("/api/v1/console/catalog/products", { params: { query } });
}

export function setProductsVisibility(headers: CsrfHeaders, body: S["SetProductsVisibilityRequest"]) {
  return browserApi.POST("/api/v1/console/catalog/products/visibility", { headers, body });
}

export function getProduct(id: string) {
  return browserApi.GET("/api/v1/console/catalog/products/{id}", { params: { path: { id } } });
}

export function updateProduct(headers: CsrfHeaders, id: string, body: S["UpdateProductRequest"]) {
  return browserApi.PUT("/api/v1/console/catalog/products/{id}", { params: { path: { id } }, headers, body });
}

export async function uploadProductImage(id: string, data: FormData) {
  const send = async () => fetch(`/api/v1/console/catalog/products/${id}/images`, { method: "POST", body: data, headers: await csrfHeader() });
  let response = await send();
  if (response.status === 400) {
    const problem = (await response.clone().json().catch(() => null)) as Problem | null;
    if (problem?.code === "auth.csrf_invalid") {
      forgetCsrf();
      response = await send();
    }
  }
  return response;
}

export function reorderImages(headers: CsrfHeaders, id: string, images: S["ProductImageOrderItem"][]) {
  return browserApi.PUT("/api/v1/console/catalog/products/{id}/images", { params: { path: { id } }, headers, body: { images } });
}

export function deleteImage(headers: CsrfHeaders, id: string, imageId: string) {
  return browserApi.DELETE("/api/v1/console/catalog/products/{id}/images/{imageId}", { params: { path: { id, imageId } }, headers });
}

export function getAttributeNames(categoryId: string | undefined) {
  return browserApi.GET("/api/v1/console/catalog/attribute-names", { params: { query: { categoryId } } });
}

export function getCategories() {
  return browserApi.GET("/api/v1/console/catalog/categories");
}

export function saveCategory(headers: CsrfHeaders, id: string | null, body: S["SaveCategoryRequest"]) {
  return id
    ? browserApi.PUT("/api/v1/console/catalog/categories/{id}", { params: { path: { id } }, headers, body })
    : browserApi.POST("/api/v1/console/catalog/categories", { headers, body });
}

export function deleteCategory(headers: CsrfHeaders, id: string) {
  return browserApi.DELETE("/api/v1/console/catalog/categories/{id}", { params: { path: { id } }, headers });
}

export function getCollections() {
  return browserApi.GET("/api/v1/console/catalog/collections");
}

export function saveCollection(headers: CsrfHeaders, id: string | null, body: S["SaveCollectionRequest"]) {
  return id
    ? browserApi.PUT("/api/v1/console/catalog/collections/{id}", { params: { path: { id } }, headers, body })
    : browserApi.POST("/api/v1/console/catalog/collections", { headers, body });
}

export function deleteCollection(headers: CsrfHeaders, id: string) {
  return browserApi.DELETE("/api/v1/console/catalog/collections/{id}", { params: { path: { id } }, headers });
}

export function getRedirects() {
  return browserApi.GET("/api/v1/console/catalog/redirects");
}

export function createRedirect(headers: CsrfHeaders, body: S["CreateRedirectRequest"]) {
  return browserApi.POST("/api/v1/console/catalog/redirects", { headers, body });
}

export function deleteRedirect(headers: CsrfHeaders, id: string) {
  return browserApi.DELETE("/api/v1/console/catalog/redirects/{id}", { params: { path: { id } }, headers });
}

export function getImportRuns() {
  return browserApi.GET("/api/v1/console/integration/runs", { params: { query: { job: "navkolo.import" } } });
}

export async function importCatalog(data: FormData) {
  const send = async () => fetch("/api/v1/console/integration/navkolo/import", { method: "POST", body: data, headers: await csrfHeader() });
  let response = await send();
  if (response.status === 400 && ((await response.clone().json().catch(() => null)) as Problem | null)?.code === "auth.csrf_invalid") {
    forgetCsrf();
    response = await send();
  }
  return response;
}
