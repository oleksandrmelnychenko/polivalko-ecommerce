export type PagerCell =
  | { kind: "page"; page: number; current: boolean; show: "all" | "wide" }
  | { kind: "gap"; show: "all" | "wide" | "narrow" };

/** The shortest hidden stretch that gets a jump link. */
const JUMP_FROM = 8;

/** A page about halfway through the hidden stretch between two shown pages, on a round number when the stretch is long. */
function jump(from: number, to: number): number | null {
  const hidden = to - from - 1;
  if (hidden < JUMP_FROM) return null;
  const step = hidden >= 40 ? 10 : hidden >= 12 ? 5 : 1;
  const middle = Math.round((from + to) / 2 / step) * step;
  return Math.min(to - 1, Math.max(from + 1, middle));
}

/**
 * Pager cells in reading order. Every screen shows the first and last pages and the current one with its neighbours
 * (`show: "all"`): the compact pager a phone row has room for. Wide screens add two more neighbours and a jump halfway
 * to each end (`show: "wide"`), so a visitor or a crawler reaches any page of a long listing in a few clicks instead of
 * one page at a time. The extra links stay in the markup on narrow screens and CSS hides them; a gap is marked for the
 * screens that need it, so neither layout shows two in a row.
 */
export function pagerCells(page: number, totalPages: number): PagerCell[] {
  const inRange = (n: number) => n >= 1 && n <= totalPages;
  const core = new Set([1, totalPages, page - 1, page, page + 1].filter(inRange));
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, page + 2);
  const jumps = [jump(1, windowStart), jump(windowEnd, totalPages)].filter((n): n is number => n !== null);
  const shown = [...new Set([...core, windowStart, windowEnd, ...jumps])].sort((a, b) => a - b);

  const cells: PagerCell[] = [];
  let previous = 0;
  let previousCore = 0;
  // Whether the stretch since the last page every screen shows already has a gap that narrow screens see.
  let narrowGapShown = false;
  for (const n of shown) {
    if (previous > 0 && n - previous > 1) {
      cells.push({ kind: "gap", show: narrowGapShown ? "wide" : "all" });
      narrowGapShown = true;
    }
    if (core.has(n)) {
      if (previousCore > 0 && n - previousCore > 1 && !narrowGapShown) cells.push({ kind: "gap", show: "narrow" });
      previousCore = n;
      narrowGapShown = false;
    }
    cells.push({ kind: "page", page: n, current: n === page, show: core.has(n) ? "all" : "wide" });
    previous = n;
  }
  return cells;
}
