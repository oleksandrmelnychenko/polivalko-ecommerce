export const COMPARISON_NOTICE = "polivalko:comparison-notice";
export type ComparisonNotice = { kind: "added" | "removed" | "error"; name: string; message?: string; groupKey?: string };

export function notifyComparison(notice: ComparisonNotice) {
  window.dispatchEvent(new CustomEvent<ComparisonNotice>(COMPARISON_NOTICE, { detail: notice }));
}
