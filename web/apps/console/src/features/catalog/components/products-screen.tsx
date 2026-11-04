"use client";

import { Suspense, useState } from "react";
import { withCsrf } from "@/shared/csrf";
import { useConsoleData } from "@/shared/use-console-data";
import { PageHead } from "@/shared/ui/page-head";
import { Pager } from "@/shared/ui/pager";
import { useSelection } from "@/shared/ui/selection";
import { StateBox } from "@/shared/ui/state-box";
import { problemTitle } from "@polivalko/shared/api/problem";
import { getCategoryTree, getProducts, setProductsVisibility } from "../api/client";
import { useProductsQuery } from "../hooks/use-products-query";
import { categoryOptions } from "../lib/category-options";
import { FILTERS, PAGE_SIZE } from "../lib/product-filters";
import { CatalogTabs } from "./catalog-tabs";
import { ProductsBulkBar } from "./products-bulk-bar";
import { ProductsFilters } from "./products-filters";
import { ProductsTable } from "./products-table";

export function ProductsScreen() {
  return (
    <Suspense fallback={null}>
      <Products />
    </Suspense>
  );
}

function Products() {
  const selection = useSelection();
  const { f, page, go, reset, filtered } = useProductsQuery(selection);
  const [bulk, setBulk] = useState<{ busy: boolean; message?: string; error?: boolean }>({ busy: false });

  const categories = useConsoleData("categories-tree", () => getCategoryTree());
  const products = useConsoleData(`${FILTERS.map((k) => f[k]).join("|")}|${page}`, () =>
    getProducts({
      q: f.q || undefined,
      categoryId: f.categoryId || undefined,
      visible: f.visible === "" ? undefined : f.visible === "true",
      stock: f.stock || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
  );

  const options = categories.data ? categoryOptions(categories.data) : [];

  async function setVisible(visible: boolean) {
    const productIds = [...selection.selected];
    setBulk({ busy: true });
    const result = await withCsrf((headers) => setProductsVisibility(headers, { productIds, visible }));
    if (result.data) {
      selection.clear();
      setBulk({
        busy: false,
        message:
          result.data.updated === 0
            ? `Нічого не змінилося: вибрані товари вже ${visible ? "показуються" : "приховані"}.`
            : `${visible ? "Показано на сайті" : "Приховано з сайту"}: ${result.data.updated}.`,
      });
      products.reload();
    } else {
      setBulk({ busy: false, error: true, message: problemTitle(result.error, "Не вдалося змінити видимість.") });
    }
  }

  const items = products.data?.items ?? [];
  return (
    <>
      <PageHead title="Каталог" sub="Назви, ціни й залишки приходять з Navkolo; тут — показ на сайті, описи, фото й розділи." />
      <CatalogTabs />
      <ProductsFilters f={f} options={options} filtered={filtered} go={go} reset={reset} />

      {bulk.message && (
        <p className={`notice ${bulk.error ? "notice--error" : "notice--ok"} console-notice`} role="status">
          {bulk.message}
        </p>
      )}

      <StateBox state={products} empty={products.data?.items.length === 0 ? "Товарів за цими умовами немає." : undefined}>
        {products.data && (
          <>
            <ProductsTable items={items} selection={selection} />
            <Pager page={page} totalPages={products.data.totalPages} totalItems={products.data.totalItems} pageSize={PAGE_SIZE} onPage={(n) => go({ page: String(n) })} />
          </>
        )}
      </StateBox>

      {selection.selected.size > 0 && <ProductsBulkBar selection={selection} busy={bulk.busy} onVisible={setVisible} />}
    </>
  );
}
