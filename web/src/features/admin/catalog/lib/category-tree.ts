import type { components } from "@/shared/api/schema";

export type AdminCategory = components["schemas"]["ConsoleCategoryDto"];

export function descendants(all: AdminCategory[], parentId: string, depth: number): AdminCategory[] {
  return all.filter((c) => c.parentId === parentId).flatMap((c) => [c, ...descendants(all, c.id, depth + 1)]);
}

export function depthOf(all: AdminCategory[], category: AdminCategory) {
  let depth = 0;
  for (let c: AdminCategory | undefined = category; c?.parentId; c = all.find((x) => x.id === c!.parentId)) depth++;
  return depth;
}
