import { showProductNotice, type ProductNotice } from "@/shared/ui/product-notice";

type ComparisonNotice = { kind: ProductNotice["kind"]; name: string; message?: string; groupKey?: string };

export function notifyComparison({ kind, name, message, groupKey }: ComparisonNotice) {
  showProductNotice({
    kind,
    title: kind === "added" ? "Додано до порівняння" : kind === "removed" ? "Прибрано з порівняння" : "Не вдалося додати товар",
    message: message ?? name,
    action: { href: groupKey ? `/compare?group=${encodeURIComponent(groupKey)}` : "/compare", label: "Переглянути порівняння" },
  });
}
