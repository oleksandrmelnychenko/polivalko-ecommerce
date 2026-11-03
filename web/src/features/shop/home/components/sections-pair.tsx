import { connection } from "next/server";
import { CategoryGrid, CategoryTile } from "@/features/shop/catalog";
import { getCategoryTree } from "@/features/shop/catalog/server";
import { pagePhotos } from "@/shared/lib/stand-in-photos";
import { Look } from "./look";
import { Strip } from "./strip";

export async function SectionsPair() {
  await connection();
  const categories = await getCategoryTree();
  const photo = pagePhotos.sections;
  return (
    <>
      <Look id="sections-title" title="Розділи каталогу" sub="Усе для дому, саду й городу" ghost="Для вашого городу" photo={photo}>
        <CategoryGrid categories={categories.slice(0, 6)} columns={3} look />
      </Look>
      <Strip id="sections-strip-title" title="Розділи каталогу" sub="Від лійки до газонокосарки" side="left">
        <ul className="tiles tiles--rail">
          {categories.map((c) => (
            <CategoryTile key={c.id} category={c} look />
          ))}
        </ul>
      </Strip>
    </>
  );
}
