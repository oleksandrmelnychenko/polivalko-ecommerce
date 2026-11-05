import { upcomingSpecialDays } from "../lib/special-days";
import type { SpecialDay } from "../lib/site-types";

export function SpecialDays({ days, limit }: { days: SpecialDay[] | null | undefined; limit?: number }) {
  const upcoming = upcomingSpecialDays(days, limit);
  if (upcoming.length === 0) return null;
  return (
    <ul className="special-days" aria-label="Особливі дні">
      {upcoming.map((d) => (
        <li key={d.key}>
          <span className="special-days__date">{d.date}</span> {d.label}: {d.note}
        </li>
      ))}
    </ul>
  );
}
