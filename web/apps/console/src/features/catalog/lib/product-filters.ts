export const PAGE_SIZE = 30;
export const FILTERS = ["q", "categoryId", "visible", "stock"] as const;
export type ProductFilter = (typeof FILTERS)[number];
export type ProductFilters = Record<ProductFilter, string>;
