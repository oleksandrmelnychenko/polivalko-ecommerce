import type { Category, CategoryNode } from "@polivalko/shared/api/types";

/**
 * The sections above `slug` in the category tree, from the top; null when the tree has no such section.
 * Every page already holds the tree (the header menu), so breadcrumbs and sibling chips read it instead of asking the
 * API for the section again after the page's own data has arrived.
 */
export function categoryAncestors(tree: CategoryNode[], slug: string): CategoryNode[] | null {
  for (const node of tree) {
    if (node.slug === slug) return [];
    const below = categoryAncestors(node.children, slug);
    if (below) return [node, ...below];
  }
  return null;
}

/** The subsections of `slug`, as a reference each, in the tree's order; undefined when the tree has no such section. */
export function categoryChildren(tree: CategoryNode[], slug: string): Category["children"] | undefined {
  const ancestors = categoryAncestors(tree, slug);
  if (!ancestors) return undefined;
  const siblings = ancestors.length ? ancestors[ancestors.length - 1].children : tree;
  return siblings.find((node) => node.slug === slug)?.children.map(({ id, slug, name }) => ({ id, slug, name }));
}
