export const PAGE_SIZE = 20;
export const FILTERS = ["q", "status", "paymentStatus", "delivery", "from", "to", "sort"] as const;
export const sortLabel = { newest: "Спершу нові", oldest: "Спершу старі", totalDesc: "Сума: більша", totalAsc: "Сума: менша" } as const;
export type Sort = keyof typeof sortLabel;
export type Filter = (typeof FILTERS)[number];
export type Filters = Record<Filter, string>;
