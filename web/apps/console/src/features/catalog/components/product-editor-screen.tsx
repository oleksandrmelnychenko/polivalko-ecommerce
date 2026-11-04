"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { getCategoryTree, getProduct } from "../api/client";
import { CatalogTabs } from "./catalog-tabs";
import { ProductEditorForm } from "./product-editor-form";
import { ProductEditorImages } from "./product-editor-images";
import { ProductEditorNavkolo } from "./product-editor-navkolo";

export function ProductEditorScreen() {
  const { id } = useParams<{ id: string }>();
  const product = useConsoleData(id, () => getProduct(id));
  const categories = useConsoleData("categories-tree", () => getCategoryTree());

  return (
    <>
      <nav className="crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/catalog">Каталог</Link>
          </li>
          <li aria-current="page">{product.data?.displayName ?? product.data?.navkolo.name ?? "Товар"}</li>
        </ol>
      </nav>
      <CatalogTabs />
      <StateBox state={product}>
        {product.data && (
          <div className="console-columns">
            <div>
              <ProductEditorForm key={product.data.updatedAt} product={product.data} categories={categories.data ?? []} onSaved={product.setData} />
              <ProductEditorImages product={product.data} onChange={product.setData} />
            </div>
            <ProductEditorNavkolo product={product.data} />
          </div>
        )}
      </StateBox>
    </>
  );
}
