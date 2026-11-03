export const compact = new Intl.NumberFormat("uk-UA", { notation: "compact", maximumFractionDigits: 1 });
export const shortDate = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short", timeZone: "Europe/Kyiv" });
export const longDate = new Intl.DateTimeFormat("uk-UA", { weekday: "short", day: "numeric", month: "long", timeZone: "Europe/Kyiv" });
export const asDate = (d: string) => new Date(`${d}T12:00:00+03:00`);

export function niceMax(value: number) {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 2.5, 5, 10].find((m) => m * pow >= value) ?? 10) * pow;
}

export function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
