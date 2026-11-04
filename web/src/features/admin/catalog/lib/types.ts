import type { components } from "@/shared/api/schema";

export type Product = components["schemas"]["ConsoleProductDto"];
export type Attribute = components["schemas"]["ProductAttributeDto"];
export type AdminCollection = components["schemas"]["ConsoleCollectionDto"];
export type ProductRow = components["schemas"]["ConsoleProductListItemDto"];
export type ImportRun = components["schemas"]["ImportRunDto"];
