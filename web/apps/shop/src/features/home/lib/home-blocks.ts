export const HOME_BLOCKS = ["hero", "offers", "collections", "categories", "perks", "services", "steps", "visit"] as const;

export type HomeBlockKey = (typeof HOME_BLOCKS)[number];

const isBlock = (key: string): key is HomeBlockKey => (HOME_BLOCKS as readonly string[]).includes(key);

export function homeBlocks(blocks: { key: string; visible: boolean }[] | null | undefined): HomeBlockKey[] {
  if (!blocks?.length) return [...HOME_BLOCKS];
  const ordered: HomeBlockKey[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    if (!isBlock(block.key) || seen.has(block.key)) continue;
    seen.add(block.key);
    if (block.visible !== false) ordered.push(block.key);
  }
  return ordered;
}
