import type { CategoryNode } from "@/shared/api/types";

export function categoryOptions(categories: CategoryNode[]) {
  const options: { id: string; name: string }[] = [];
  const walk = (nodes: CategoryNode[], depth: number) =>
    nodes.forEach((n) => {
      options.push({ id: n.id, name: `${"— ".repeat(depth)}${n.name}` });
      walk(n.children, depth + 1);
    });
  walk(categories, 0);
  return options;
}
