"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { EyeIcon, SearchIcon } from "@/components/icons";
import { browserApi } from "@/lib/api/browser";
import { useAdminData } from "@/lib/admin";
import { formatDateTime, formatMoney } from "@/lib/format";
import { thumb } from "@/lib/images";
import { CheckAll, PageHead, Pager, StateBox, StockText, useSelection } from "../ui";
import { CatalogTabs, mutate, problemTitle } from "./_shared";

const PAGE_SIZE = 30;
const FILTERS = ["q", "categoryId", "visible", "stock"] as const;

export default function AdminCatalogPage() {
  return (
    <Suspense fallback={null}>
      <Products />
    </Suspense>
  );
}

/** Товари сайту: пошук, розділ, видимість, залишок; масово показати чи приховати. Ціни й залишки — з Navkolo. */
function Products() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ""])) as Record<(typeof FILTERS)[number], string>;
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const [text, setText] = useState(f.q);
  const selection = useSelection();
  const [bulk, setBulk] = useState<{ busy: boolean; message?: string; error?: boolean }>({ busy: false });

  const categories = useAdminData("categories-tree", () => browserApi.GET("/api/v1/categories"));
  const products = useAdminData(`${FILTERS.map((k) => f[k]).join("|")}|${page}`, () =>
    browserApi.GET("/api/v1/admin/catalog/products", {
      params: {
        query: {
          q: f.q || undefined,
          categoryId: f.categoryId || undefined,
          visible: f.visible === "" ? undefined : f.visible === "true",
          stock: f.stock || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
      },
    }),
  );

  const go = (patch: Partial<Record<(typeof FILTERS)[number] | "page", string>>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    selection.clear();
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const filtered = FILTERS.some((k) => f[k]);

  // Плаский список розділів з відступом для підрозділів.
  const options: { id: string; name: string }[] = [];
  const walk = (nodes: NonNullable<typeof categories.data>, depth: number) =>
    nodes.forEach((n) => {
      options.push({ id: n.id, name: `${"— ".repeat(depth)}${n.name}` });
      walk(n.children, depth + 1);
    });
  if (categories.data) walk(categories.data, 0);

  async function setVisible(visible: boolean) {
    const productIds = [...selection.selected];
    setBulk({ busy: true });
    const result = await mutate((headers) => browserApi.POST("/api/v1/admin/catalog/products/visibility", { headers, body: { productIds, visible } }));
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
      <form
        className="admin-filters"
        role="search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          go({ q: text.trim() });
        }}
      >
        <div className="field field--wide">
          <label htmlFor="q">Пошук</label>
          <span className="input-icon">
            <SearchIcon />
            <input id="q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Назва або артикул…" autoComplete="off" spellCheck={false} />
          </span>
        </div>
        <div className="field">
          <label htmlFor="category">Розділ</label>
          <select id="category" value={f.categoryId} onChange={(e) => go({ categoryId: e.target.value })}>
            <option value="">Усі розділи</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="stock">Залишок</label>
          <select id="stock" value={f.stock} onChange={(e) => go({ stock: e.target.value })}>
            <option value="">Будь-який</option>
            <option value="in">Є в наявності</option>
            <option value="low">Закінчується (до 3)</option>
            <option value="out">Немає</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="visible">На сайті</label>
          <select id="visible" value={f.visible} onChange={(e) => go({ visible: e.target.value })}>
            <option value="">Усі</option>
            <option value="true">Показуються</option>
            <option value="false">Приховані</option>
          </select>
        </div>
        <div className="admin-filters__actions">
          <button type="submit" className="btn">
            Знайти
          </button>
          {filtered && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setText("");
                selection.clear();
                router.replace(pathname, { scroll: false });
              }}
            >
              Скинути
            </button>
          )}
        </div>
      </form>

      {bulk.message && (
        <p className={`notice ${bulk.error ? "notice--error" : "notice--ok"} admin-notice`} role="status">
          {bulk.message}
        </p>
      )}

      <StateBox state={products} empty={products.data?.items.length === 0 ? "Товарів за цими умовами немає." : undefined}>
        {products.data && (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col" className="col-check">
                      <CheckAll keys={items.map((p) => p.id)} selection={selection} label="Вибрати всі товари на сторінці" />
                    </th>
                    <th scope="col">Товар</th>
                    <th scope="col">Розділ</th>
                    <th scope="col" className="num">
                      Ціна
                    </th>
                    <th scope="col" className="num">
                      Залишок
                    </th>
                    <th scope="col">На сайті</th>
                    <th scope="col">Змінено</th>
                    <th scope="col" className="col-actions">
                      <span className="visually-hidden">Дії</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} data-selected={selection.has(p.id) || undefined}>
                      <td className="col-check">
                        <input type="checkbox" aria-label={`Вибрати «${p.displayName ?? p.name}»`} checked={selection.has(p.id)} onChange={() => selection.toggle(p.id)} />
                      </td>
                      <td>
                        <span className="cell-main">
                          {p.imageUrl ? <img className="admin-thumb" src={thumb(p.imageUrl, 120)} alt="" loading="lazy" /> : <span className="admin-thumb" />}
                          <span>
                            <Link href={`/admin/catalog/products/${p.id}`} className="cell-strong" style={{ textDecoration: "none" }}>
                              {p.displayName ?? p.name}
                            </Link>
                            <span className="cell-sub">
                              <span className="code">{p.sku}</span>
                              {!p.hasDescription && " · без опису"}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>{p.categoryName}</td>
                      <td className="num cell-strong">{formatMoney(p.price)}</td>
                      <td className="num">
                        <StockText stock={p.stock} />
                      </td>
                      <td>{p.isVisible ? <span className="chip chip--green">Показується</span> : <span className="chip chip--grey">Прихований</span>}</td>
                      <td className="admin-nowrap">
                        <span className="admin-small muted">{formatDateTime(p.updatedAt)}</span>
                      </td>
                      <td className="col-actions">
                        <a className="btn btn--small btn--ghost btn--icon" href={`/product/${p.slug}`} target="_blank" rel="noopener" aria-label={`Відкрити «${p.displayName ?? p.name}» на сайті`} title="На сайті">
                          <EyeIcon />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} totalPages={products.data.totalPages} totalItems={products.data.totalItems} pageSize={PAGE_SIZE} onPage={(n) => go({ page: String(n) })} />
          </>
        )}
      </StateBox>

      {selection.selected.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Дії з вибраними товарами">
          <span className="bulk-bar__count">
            <b>{selection.selected.size}</b>вибрано
          </span>
          <button type="button" className="btn btn--small btn--accent" disabled={bulk.busy} onClick={() => setVisible(true)}>
            Показати на сайті
          </button>
          <button type="button" className="btn btn--small btn--accent" disabled={bulk.busy} onClick={() => setVisible(false)}>
            Приховати
          </button>
          <button type="button" className="btn btn--small btn--ghost" onClick={selection.clear}>
            Зняти вибір
          </button>
        </div>
      )}
    </>
  );
}
