import { connection } from "next/server";
import { ProductTiles } from "@/features/catalog";
import { getCollections } from "@/features/catalog/server";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { Look } from "./look";
import { RailTiles } from "./rail-tiles";
import { Strip } from "./strip";

const SUB = "Радимо зараз";

export async function CollectionPairs() {
  await connection();
  const [first, ...rest] = (await getCollections()).filter((c) => c.items.length > 0);
  if (!first) return null;
  return (
    <>
      <Look id="collection-title" title={first.title} sub={SUB} ghost="Для вашого дому" photo={pagePhotos.collection} reverse>
        <ProductTiles products={first.items.slice(0, 6)} columns={3} look />
      </Look>
      <Strip id="collection-strip-title" title={first.title} sub={SUB} side="right">
        <RailTiles products={first.items} />
      </Strip>
      {rest.map((collection, i) => (
        <Strip key={`${collection.code}-${i}`} id={`collection-${i + 2}-title`} title={collection.title} sub={SUB} side={i % 2 === 0 ? "left" : "right"}>
          <RailTiles products={collection.items} />
        </Strip>
      ))}
    </>
  );
}
