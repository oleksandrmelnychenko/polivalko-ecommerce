import { CategoryTile, type CategoryItem } from "./category-tile";

export function CategoryGrid({ categories, columns = 4, look }: { categories: CategoryItem[]; columns?: 3 | 4; look?: boolean }) {
  return (
    <ul className={`tiles tiles--${columns}`}>
      {categories.map((c) => (
        <CategoryTile key={c.id} category={c} look={look} />
      ))}
    </ul>
  );
}
