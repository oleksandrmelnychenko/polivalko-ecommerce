"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney } from "@polivalko/shared/lib/format";
import { hasPrice, PRICE_ON_REQUEST } from "@/shared/lib/price";
import { CloseIcon } from "@polivalko/shared/ui/icons";
import { comparisonGroup, comparisonRows, type CompareProduct } from "./model";
import { clearComparisonGroup, loadComparisonProduct, refreshComparison, removeComparison, useComparison } from "./store";

export function CompareScreen({ initialGroup = "" }: { initialGroup?: string }) {
  const saved = useComparison();
  const [activeKey, setActiveKey] = useState(initialGroup);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
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
  const active = groups.get(activeKey) ?? [...groups.values()][0];
  const products = active?.products ?? [];
  const rows = comparisonRows(products);
  const visibleRows = onlyDifferences && products.length > 1 ? rows.filter(row => row.differs) : rows;
  const categoryHref = active?.slug ? `/catalog/${active.slug}` : "/catalog";
  const addSlot = products.length < 4;

  return <div className="container compare-page">
    <header className="page-head compare-page__head">
      <nav className="crumbs" aria-label="Хлібні крихти"><ol><li><Link href="/">Головна</Link></li><li aria-current="page">Порівняння</li></ol></nav>
      <h1>Порівняння товарів</h1>
      <p>Порівнюйте характеристики до 4 товарів одного типу.</p>
    </header>
    {loading ? <p role="status" className="compare-loading">Завантажуємо характеристики…</p> : saved.length === 0 ?
      <div className="compare-empty"><span className="compare-empty__symbol" aria-hidden="true">⇄</span><h2>Товарів для порівняння ще немає</h2><p>У каталозі натисніть іконку порівняння на фото товару, під сердечком. Товари різних типів зберуться в окремі групи.</p><Link href="/catalog" className="btn">Обрати товари</Link></div> : <>
      <nav className="compare-groups" aria-label="Групи порівняння">{[...groups.values()].map(group => <button key={group.key} type="button" aria-pressed={active?.key === group.key} onClick={() => { setActiveKey(group.key); setOnlyDifferences(false); }}>{group.name}<span>{group.products.length}</span></button>)}</nav>
      {failed.length > 0 && <div role="alert" className="notice">Не вдалося оновити частину товарів. Показуємо останні збережені дані. <button type="button" className="link" onClick={() => setRetry(value => value + 1)}>Спробувати ще раз</button></div>}
      <div className="compare-toolbar">
        <label className="consent"><input type="checkbox" checked={onlyDifferences} disabled={products.length < 2} onChange={event => setOnlyDifferences(event.target.checked)} />Тільки відмінності</label>
        <button className="compare-clear" type="button" onClick={() => active && clearComparisonGroup(active.key)}>Очистити цю групу</button>
      </div>
      {products.length === 1 && <p className="compare-hint">Додайте ще товар цього типу, щоб побачити відмінності.</p>}
      <div className="comparison-scroll" role="region" aria-label={`Порівняння: ${active?.name}`} tabIndex={0}>
        <table className="comparison-grid">
          <caption className="visually-hidden">Характеристики товарів: {active?.name}</caption>
          <colgroup><col className="comparison-grid__labels" />{products.map(p => <col key={p.id} className="comparison-grid__product" />)}{addSlot && <col className="comparison-grid__product" />}</colgroup>
          <thead><tr><th scope="col" className="comparison-intro"><span>Ваш вибір</span><strong>{active?.name}</strong><Link href={categoryHref}>Усі товари категорії →</Link></th>
            {products.map(product => <th scope="col" key={product.id}><article className="comparison-product">
              <button className="comparison-product__remove" type="button" aria-label={`Прибрати: ${product.name}`} onClick={() => removeComparison(product.id)}><CloseIcon /></button>
              <Link href={`/product/${product.slug}`} className="comparison-product__photo">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} width={260} height={240} /> : <span>Фото відсутнє</span>}</Link>
              <Link href={`/product/${product.slug}`} className="comparison-product__name">{product.name}</Link>
            </article></th>)}
            {addSlot && <th><Link href={categoryHref} className="comparison-add"><span aria-hidden="true">+</span><strong>Додати товар</strong><small>З цієї категорії</small></Link></th>}
          </tr></thead>
          <tbody>
            <tr className="comparison-section"><th scope="row" colSpan={1 + products.length + Number(addSlot)}>Характеристики</th></tr>
            {visibleRows.map(row => <tr key={row.key} className={row.differs ? "comparison-row--different" : undefined}><th scope="row">{row.name}</th>{row.values.map((value, i) => <td key={products[i].id}>{row.key === "price" ? <div className="comparison-price"><strong>{hasPrice(products[i].price) ? formatMoney(products[i].price) : PRICE_ON_REQUEST}</strong>{products[i].oldPrice && Number(products[i].oldPrice!.value) > Number(products[i].price.value) && <s>{formatMoney(products[i].oldPrice!)}</s>}</div> : value}</td>)}{addSlot && <td aria-hidden="true" />}</tr>)}
            {visibleRows.length === 0 && <tr><td colSpan={1 + products.length + Number(addSlot)}>У заповнених характеристиках відмінностей немає.</td></tr>}
          </tbody>
        </table>
      </div>
      {products.every(p => !p.attributes?.length) && <p className="compare-hint">Детальні характеристики цих товарів ще не заповнені.</p>}
    </>}
  </div>;
}
