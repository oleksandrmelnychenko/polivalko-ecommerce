import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

/**
 * Клієнт для Server Components. Ходить в ASP.NET Core API внутрішньою мережею.
 * Типи згенеровано з openapi/polivalko-api.json (`npm run api:types`).
 */
export const api = createClient<paths>({
  baseUrl: process.env.API_INTERNAL_URL ?? "http://localhost:5080",
});

type S = components["schemas"];
export type CategoryNode = S["CategoryNodeDto"];
export type Category = S["CategoryDto"];
export type ProductListItem = S["ProductListItemDto"];
export type ProductDetails = S["ProductDetailsDto"];
export type ProductSearch = S["ProductSearchResponse"];
export type Money = S["MoneyDto"];
export type ServiceDirection = S["ServiceDirectionDto"];
export type PhotoCredit = S["PhotoCreditDto"];
export type PickupPoint = S["PickupPointDto"];
export type Order = S["OrderDto"];
export type OrderStatus = S["OrderStatus"];
export type PaymentStatus = S["PaymentStatus"];
export type Collection = S["CollectionDto"];
export type ContentPage = S["PageDto"];
export type Contacts = S["ContactsDto"];
export type Seller = S["SellerDto"];
export type Receipt = S["ReceiptDto"];
