/** Text no longer than `max` characters: a longer one is cut at a word boundary and marked with an ellipsis. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const lastSpace = head.lastIndexOf(" ");
  // A space only near the start means one very long word: cutting there would leave almost nothing.
  const cut = lastSpace > max * 0.6 ? head.slice(0, lastSpace) : head;
  return `${cut.replace(/[\s.,;:–—-]+$/, "")}…`;
}
