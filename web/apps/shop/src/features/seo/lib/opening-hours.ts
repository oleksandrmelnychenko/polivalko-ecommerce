import type { Contacts } from "@polivalko/shared/api/types";

const DAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY = DAYS.join("|");
const SLOT = new RegExp(
  `(?<![а-яіїєґ])((?:${DAY})(?:\\s*[–—,-]\\s*(?:${DAY}))*)(?![а-яіїєґ])\\.?[\\s,:]+(\\d{1,2})[:.](\\d{2})\\s*[–—-]\\s*(\\d{1,2})[:.](\\d{2})`,
  "giu",
);
const HOURS = /(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})/u;

type SpecialDay = NonNullable<Contacts["specialDays"]>[number];

function time(hours: string, minutes: string): string {
  return `${hours.padStart(2, "0")}:${minutes}`;
}

function expandDays(text: string): string[] {
  const days = new Set<string>();
  for (const part of text.toLowerCase().split(",")) {
    const [from, to] = part.split(/[–—-]/u).map((day) => DAYS.indexOf(day.trim()));
    if (from < 0) continue;
    if (to === undefined || to < 0) {
      days.add(DAY_NAMES[from]);
      continue;
    }
    for (let step = 0; step < DAYS.length; step++) {
      const index = (from + step) % DAYS.length;
      days.add(DAY_NAMES[index]);
      if (index === to) break;
    }
  }
  return [...days];
}

export function openingHours(schedule: string | null | undefined) {
  if (!schedule) return [];
  return [...schedule.matchAll(SLOT)].flatMap(([, days, openH, openM, closeH, closeM]) => {
    const dayOfWeek = expandDays(days);
    return dayOfWeek.length > 0 ? [{ "@type": "OpeningHoursSpecification", dayOfWeek, opens: time(openH, openM), closes: time(closeH, closeM) }] : [];
  });
}

export function specialOpeningHours(days: SpecialDay[] | null | undefined) {
  return (days ?? []).flatMap((day) => {
    const period = { "@type": "OpeningHoursSpecification", validFrom: day.date, validThrough: day.date };
    if (day.closed) return [{ ...period, opens: "00:00", closes: "00:00" }];
    const match = day.hours?.match(HOURS);
    return match ? [{ ...period, opens: time(match[1], match[2]), closes: time(match[3], match[4]) }] : [];
  });
}
