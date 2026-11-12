import { connection } from "next/server";
import { CategoryGrid, CategoryTile } from "@/features/catalog";
import { getCategoryTree } from "@/features/catalog/server";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { Look } from "./look";
import { Strip } from "./strip";

export async function SectionsPair() {
  await connection();
  const categories = await getCategoryTree();
  const photo = pagePhotos.sections;
  return (
    <>
      <Look id="sections-title" title="Розділи каталогу" ghost="Каталог" photo={photo} more={{ href: "/catalog", label: "Увесь каталог" }}>
        <CategoryGrid categories={categories.slice(0, 6)} columns={3} look />
      </Look>
      <Strip id="sections-strip-title" title="Розділи каталогу" side="left">
        <ul className="tiles tiles--rail">
          {categories.map((c) => (
            <CategoryTile key={c.id} category={c} look />
          ))}
        </ul>
      </Strip>
    </>
  );
}
