"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { StateBox } from "@/shared/admin/ui/state-box";
import { getCategoryTree, getProduct } from "../api/client";
import { CatalogTabs } from "./catalog-tabs";
import { ProductEditorForm } from "./product-editor-form";
import { ProductEditorImages } from "./product-editor-images";
import { ProductEditorNavkolo } from "./product-editor-navkolo";

export function ProductEditorScreen() {
  const { id } = useParams<{ id: string }>();
  const product = useAdminData(id, () => getProduct(id));
  const categories = useAdminData("categories-tree", () => getCategoryTree());

  return (
    <>
      <nav className="crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/admin/catalog">Каталог</Link>
          </li>
          <li aria-current="page">{product.data?.displayName ?? product.data?.navkolo.name ?? "Товар"}</li>
        </ol>
      </nav>
      <CatalogTabs />
      <StateBox state={product}>
        {product.data && (
          <div className="admin-columns">
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
