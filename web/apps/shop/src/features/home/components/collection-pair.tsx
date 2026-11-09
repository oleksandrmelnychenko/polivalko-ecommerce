import { connection } from "next/server";
import { ProductTiles } from "@/features/catalog";
import { getCollections } from "@/features/catalog/server";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { Look } from "./look";
import { RailTiles } from "./rail-tiles";
import { Strip } from "./strip";

export async function CollectionPairs() {
  await connection();
  const [first, ...rest] = (await getCollections()).filter((c) => c.items.length > 0);
  if (!first) return null;
  return (
    <>
      <Look id="collection-title" title={first.title} ghost="Добірка" photo={pagePhotos.collection} reverse>
        <ProductTiles products={first.items.slice(0, 6)} columns={3} />
      </Look>
      <Strip id="collection-strip-title" title={first.title} side="right">
        <RailTiles products={first.items} />
      </Strip>
      {rest.map((collection, i) => (
        <Strip key={`${collection.code}-${i}`} id={`collection-${i + 2}-title`} title={collection.title} side={i % 2 === 0 ? "left" : "right"}>
          <RailTiles products={collection.items} />
        </Strip>
      ))}
    </>
  );
}
