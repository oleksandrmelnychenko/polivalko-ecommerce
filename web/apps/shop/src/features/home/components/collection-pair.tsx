import { connection } from "next/server";
import { ProductTiles } from "@/features/catalog";
import { getCollections } from "@/features/catalog/server";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { Look } from "./look";
import { RailTiles } from "./rail-tiles";
import { Strip } from "./strip";

export async function CollectionPair() {
  await connection();
  const collection = (await getCollections()).find((c) => c.items.length > 0);
  if (!collection) return null;
  return (
    <>
      <Look id="collection-title" title={collection.title} sub="Радимо зараз" ghost="Для вашого дому" photo={pagePhotos.collection} reverse>
        <ProductTiles products={collection.items.slice(0, 6)} columns={3} look />
      </Look>
      <Strip id="collection-strip-title" title={collection.title} sub="Радимо зараз" side="right">
        <RailTiles products={collection.items} />
      </Strip>
    </>
  );
}
