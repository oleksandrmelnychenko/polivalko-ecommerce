import { TrendUpIcon } from "@polivalko/shared/ui/icons";

export function Delta({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (previous === 0) {
    return current === 0 ? <span className="delta delta--flat">0%</span> : <span className="delta delta--flat">нове</span>;
  }
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.abs(change) < 10 ? Math.round(change * 10) / 10 : Math.round(change);
  if (rounded === 0) return <span className="delta delta--flat">0%</span>;
  const good = inverse ? rounded < 0 : rounded > 0;
  return (
    <span className={`delta ${good ? "delta--up" : "delta--down"}`}>
      <TrendUpIcon />
      {rounded > 0 ? "+" : "−"}
      {Math.abs(rounded).toLocaleString("uk-UA")}%
    </span>
  );
}
