import type { components } from "@polivalko/shared/api/schema";

export type ConsoleCategory = components["schemas"]["ConsoleCategoryDto"];

export function descendants(all: ConsoleCategory[], parentId: string, depth: number): ConsoleCategory[] {
  return all.filter((c) => c.parentId === parentId).flatMap((c) => [c, ...descendants(all, c.id, depth + 1)]);
}

export function depthOf(all: ConsoleCategory[], category: ConsoleCategory) {
  let depth = 0;
  for (let c: ConsoleCategory | undefined = category; c?.parentId; c = all.find((x) => x.id === c!.parentId)) depth++;
  return depth;
}
