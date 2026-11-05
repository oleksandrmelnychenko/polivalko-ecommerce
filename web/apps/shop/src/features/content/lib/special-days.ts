import type { SpecialDay } from "./site-types";

const DAY = /^\d{4}-\d{2}-\d{2}/;

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const dayLabel = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", timeZone: "UTC" });

export type UpcomingDay = { key: string; date: string; label: string; note: string };

export function upcomingSpecialDays(days: SpecialDay[] | null | undefined, limit?: number): UpcomingDay[] {
  const from = today();
  const upcoming = (days ?? [])
    .filter((d) => DAY.test(d.date) && d.date.slice(0, 10) >= from)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const iso = d.date.slice(0, 10);
      return {
        key: `${iso}-${d.label}`,
        date: dayLabel.format(new Date(`${iso}T00:00:00Z`)),
        label: d.label,
        note: d.closed ? "вихідний" : d.hours?.trim() || "особливий графік",
      };
    });
  return limit ? upcoming.slice(0, limit) : upcoming;
}
