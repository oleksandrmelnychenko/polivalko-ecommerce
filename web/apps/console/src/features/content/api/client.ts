import type { CsrfHeaders } from "@/shared/csrf";
import { browserApi } from "@polivalko/shared/api/browser";
import type { components } from "@polivalko/shared/api/schema";

type S = components["schemas"];

export function getPages() {
  return browserApi.GET("/api/v1/console/content/pages");
}

export function getPage(slug: string) {
  return browserApi.GET("/api/v1/console/content/pages/{slug}", { params: { path: { slug } } });
}

export function savePage(headers: CsrfHeaders, slug: string, body: S["SavePageRequest"]) {
  return browserApi.PUT("/api/v1/console/content/pages/{slug}", { params: { path: { slug } }, headers, body });
}

export function getContacts() {
  return browserApi.GET("/api/v1/console/content/contacts");
}

export function saveContacts(headers: CsrfHeaders, body: S["ContactsDto"]) {
  return browserApi.PUT("/api/v1/console/content/contacts", { headers, body });
}

export function getServices() {
  return browserApi.GET("/api/v1/console/content/services");
}

export function saveService(headers: CsrfHeaders, code: string, body: S["SaveServiceDirectionRequest"]) {
  return browserApi.PUT("/api/v1/console/content/services/{code}", { params: { path: { code } }, headers, body });
}

export function getPickupPoints() {
  return browserApi.GET("/api/v1/console/delivery/pickup-points");
}

export function savePickupPoint(headers: CsrfHeaders, code: string, body: S["UpdatePickupPointRequest"]) {
  return browserApi.PUT("/api/v1/console/delivery/pickup-points/{code}", { params: { path: { code } }, headers, body });
}
