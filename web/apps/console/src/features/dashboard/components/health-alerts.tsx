import Link from "next/link";
import { formatDateTime } from "@polivalko/shared/lib/format";
import { AlertIcon, CheckIcon } from "@polivalko/shared/ui/icons";
import type { Summary } from "../lib/types";

export function HealthAlerts({ summary }: { summary: Summary }) {
  const issues = [
    !summary.catalogDataFresh &&
      `Ціни й залишки не оновлювалися${summary.lastPriceSync ? ` з ${formatDateTime(summary.lastPriceSync)}` : ""}: нові замовлення приймаються як заявки без онлайн-оплати.`,
    summary.failedOperations > 0 && `Невиконаних фонових операцій: ${summary.failedOperations}.`,
    summary.pendingRefunds > 0 && `Повернень коштів в обробці: ${summary.pendingRefunds}.`,
  ].filter((i): i is string => Boolean(i));

  return (
    <div className="dash-alerts" role="status">
      {issues.length === 0 ? (
        <p className="dash-alert dash-alert--ok">
          <CheckIcon />
          Інтеграції в нормі{summary.lastPriceSync ? `, ціни оновлено ${formatDateTime(summary.lastPriceSync)}` : ""}.
          <Link href="/integration" className="link">
            Інтеграції
          </Link>
        </p>
      ) : (
        issues.map((issue) => (
          <p key={issue} className="dash-alert">
            <AlertIcon />
            {issue}
            <Link href="/integration" className="link">
              Розібратися
            </Link>
          </p>
        ))
      )}
    </div>
  );
}
