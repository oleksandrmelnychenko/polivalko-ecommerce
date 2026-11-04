import { formatMoney } from "@polivalko/shared/lib/format";
import type { Dashboard } from "./types";

export function bestDay(data: Dashboard) {
  const best = data.byDay.reduce<Dashboard["byDay"][number] | null>((b, d) => (Number(d.revenue.value) > Number(b?.revenue.value ?? 0) ? d : b), null);
  if (!best) return "—";
  const date = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", timeZone: "Europe/Kyiv" }).format(new Date(`${best.date}T12:00:00+03:00`));
  return `${date}, ${formatMoney(best.revenue)}`;
}
