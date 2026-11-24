"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useHydrated } from "@/shared/hooks/use-hydrated";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatMoney } from "@polivalko/shared/lib/format";
import { sized } from "@polivalko/shared/lib/images";
import { hasPrice, PRICE_ON_REQUEST } from "@/shared/lib/price";
import { CloseIcon, PlusIcon } from "@polivalko/shared/ui/icons";
import { comparisonGroup, comparisonRows, type CompareProduct } from "./model";
import { ComparisonColumnNames } from "./column-names";
import { clearComparisonGroup, loadComparisonProduct, refreshComparison, removeComparison, useComparison } from "./store";

export function CompareScreen() {
  const group = useSearchParams().get("group") ?? "";
  return <ComparisonGroups selectedGroup={group} />;
}

function ComparisonPrice({ product, lowest }: { product: CompareProduct; lowest: boolean }) {
  if (!hasPrice(product.price)) return <span>{PRICE_ON_REQUEST}</span>;
  const oldPrice = product.oldPrice;
  return (
    <div className="comparison-price">
      <strong>{formatMoney(product.price)}</strong>
      {oldPrice && Number(oldPrice.value) > Number(product.price.value) && (
        <s><span className="visually-hidden">Попередня ціна </span>{formatMoney(oldPrice)}</s>
      )}
      {lowest && <span className="comparison-price__lowest">Найнижча ціна</span>}
    </div>
  );
}

function ComparisonGroups({ selectedGroup }: { selectedGroup: string }) {
  const hydrated = useHydrated();
  const saved = useComparison();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tableOverflows, setTableOverflows] = useState(false);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const signature = saved.map(p => p.slug).join(",");

  useEffect(() => {
    let cancelled = false;
    const slugs = signature ? signature.split(",") : [];
    Promise.allSettled(slugs.map(loadComparisonProduct)).then(results => {
      if (cancelled) return;
      const loaded = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
      if (loaded.length) refreshComparison(loaded);
      setFailed(slugs.filter((_, index) => results[index].status === "rejected"));
    });
    return () => { cancelled = true; };
  }, [signature, retry]);

  const groups = new Map<string, { key: string; name: string; slug: string; products: CompareProduct[] }>();
  saved.forEach(product => {
    const group = comparisonGroup(product);
    const existing = groups.get(group.key);
    if (existing) existing.products.push(product);
    else groups.set(group.key, { ...group, products: [product] });
  });
  const active = groups.get(selectedGroup) ?? [...groups.values()][0];
  const products = active?.products ?? [];
  const productCount = products.length;
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!hydrated || productCount <= 2 || !scroller) return;
    const measure = () => setTableOverflows(scroller.scrollWidth > scroller.clientWidth + 1);
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(scroller);
    return () => resize.disconnect();
  }, [hydrated, productCount]);
  const rows = comparisonRows(products);
  const differences = rows.filter(row => row.differs);
  const visibleRows = onlyDifferences && products.length > 1 ? differences : [
    ...rows.filter(row => row.key === "price"),
    ...differences.filter(row => row.key !== "price"),
    ...rows.filter(row => row.key !== "price" && !row.differs),
  ];
  const prices = products.filter(product => hasPrice(product.price)).map(product => Number(product.price.value));
  const lowestPrice = new Set(prices).size > 1 ? Math.min(...prices) : null;
  const categoryHref = active?.slug ? `/catalog/${active.slug}` : "/catalog";

  function selectGroup(key: string) {
    if (active?.key === key) return;
    const url = new URL(window.location.href);
    url.searchParams.set("group", key);
    window.history.pushState(null, "", url);
    setOnlyDifferences(false);
  }

  if (!hydrated) return <p role="status" className="compare-loading">Завантажуємо порівняння…</p>;
  return saved.length === 0 ?
      <div className="compare-empty"><h2>Товарів для порівняння ще немає</h2><p>Оберіть у каталозі товари одного типу й натисніть іконку порівняння на кожному з них.</p><Link href="/catalog" className="btn">Обрати товари</Link></div> : <>
      {failed.length > 0 && <div role="alert" className="notice">Не вдалося оновити частину товарів. Показуємо останні збережені дані. <button type="button" className="link" onClick={() => setRetry(value => value + 1)}>Спробувати ще раз</button></div>}
      <div className="compare-toolbar">
        <nav className="compare-groups" aria-label="Групи порівняння">
          {[...groups.values()].map(group => <button key={group.key} type="button" aria-pressed={active?.key === group.key} onClick={() => selectGroup(group.key)}>{group.name}<span>{group.products.length}</span></button>)}
        </nav>
        <div className="compare-toolbar__actions">
          {products.length > 1 && <label className="consent compare-differences"><input type="checkbox" checked={onlyDifferences} onChange={event => setOnlyDifferences(event.target.checked)} />Тільки відмінності <span>{differences.length}</span></label>}
          <Link className="compare-add" href={categoryHref}>{products.length < 4 ? <><PlusIcon />Додати товар</> : "Уся категорія"}</Link>
          <button className="compare-clear" type="button" onClick={() => active && clearComparisonGroup(active.key)}>Очистити групу</button>
        </div>
      </div>
      {productCount > 2 && tableOverflows && (
        <p className="comparison-scroll-hint"><span aria-hidden="true">↔</span> Гортайте вбік, щоб побачити інші товари</p>
      )}
      <div className="comparison-table-wrap" style={{ "--comparison-count": products.length } as CSSProperties}>
        <ComparisonColumnNames products={products} scrollRef={scrollRef} />
        <div ref={scrollRef} className="comparison-scroll" role="region" aria-label={`Порівняння: ${active?.name}`} tabIndex={0}>
          <table className="comparison-grid" role="table">
            <caption className="visually-hidden">Характеристики товарів: {active?.name}</caption>
            <colgroup><col className="comparison-grid__labels" />{products.map(p => <col key={p.id} />)}</colgroup>
            <thead><tr><th scope="col">Товар</th>
              {products.map(product => <th scope="col" key={product.id}><article className="comparison-product tile--shop">
                <button className="comparison-product__remove" type="button" aria-label={`Прибрати: ${product.name}`} onClick={() => removeComparison(product.id)}><CloseIcon /></button>
                <Link href={`/product/${product.slug}`} className="comparison-product__link">
                  <span className="tile__photo comparison-product__photo">
                    {product.imageUrl
                      ? <img {...sized(product.imageUrl, "(max-width: 40rem) 55vw, 340px", 330)} alt="" width={320} height={240} />
                      : <span className="tile__photo-empty">Фото відсутнє</span>}
                  </span>
                  <span className="comparison-product__name">{product.name}</span>
                </Link>
              </article></th>)}
            </tr></thead>
            <tbody>
              {visibleRows.map(row => (
                <tr key={row.key} className={row.differs ? "comparison-row--different" : undefined}>
                  <th scope="row">
                    <span className="comparison-row__label">
                      {row.differs && <><span className="comparison-row__mark" aria-hidden="true">≠</span><span className="visually-hidden">Відмінність. </span></>}
                      {row.name}
                    </span>
                  </th>
                  {row.values.map((value, i) => (
                    <td key={products[i].id}>
                      {row.key === "price"
                        ? <ComparisonPrice product={products[i]} lowest={Number(products[i].price.value) === lowestPrice} />
                        : value}
                    </td>
                  ))}
                </tr>
              ))}
              {visibleRows.length === 0 && <tr><td colSpan={1 + products.length}>У заповнених характеристиках відмінностей немає.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {products.every(p => !p.attributes?.length) && <p className="compare-hint">Детальні характеристики цих товарів ще не заповнені.</p>}
    </>;
}
