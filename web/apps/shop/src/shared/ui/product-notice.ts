export type ProductNotice = {
  kind: "added" | "removed" | "error";
  title: string;
  message: string;
  action?: { href: string; label: string };
};

export const PRODUCT_NOTICE = "polivalko:product-notice";

export function showProductNotice(notice: ProductNotice) {
  window.dispatchEvent(new CustomEvent(PRODUCT_NOTICE, { detail: notice }));
}
