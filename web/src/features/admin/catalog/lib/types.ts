import type { components } from "@/shared/api/schema";

export type Product = components["schemas"]["AdminProductDto"];
export type Attribute = components["schemas"]["ProductAttributeDto"];
export type AdminCollection = components["schemas"]["AdminCollectionDto"];
export type ProductRow = components["schemas"]["AdminProductListItemDto"];
export type ImportRun = components["schemas"]["ImportRunDto"];
