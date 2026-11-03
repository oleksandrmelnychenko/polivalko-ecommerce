import { SORTS } from "../lib/listing-params";
import { ProductTilesSkeleton } from "./product-tiles-skeleton";

export function ListingSkeleton({ crumbs = false }: { crumbs?: boolean }) {
  return (
    <>
      <header className="page-head" aria-hidden="true">
        {crumbs && (
          <div className="crumbs">
            <ol>
              <li className="skeleton" style={{ width: "12rem" }}>
                &nbsp;
              </li>
            </ol>
          </div>
        )}
        <h1 className="skeleton" style={{ width: "min(24rem, 70%)" }}>
          &nbsp;
        </h1>
      </header>
      <div className="catalog" aria-busy="true">
        <div className="filters-panel" data-open="false" aria-hidden="true">
          <button type="button" className="btn btn--quiet btn--small filters-panel__toggle" disabled>
            Фільтри
          </button>
          <div className="filters-panel__body">
            <div className="skeleton" style={{ height: "24rem" }} />
          </div>
        </div>
        <div>
          <div className="toolbar" aria-hidden="true">
            <p className="skeleton" style={{ width: "6rem" }}>
              &nbsp;
            </p>
            <nav className="seg">
              {SORTS.map((s) => (
                <a key={s.value}>{s.label}</a>
              ))}
            </nav>
          </div>
          <ProductTilesSkeleton count={6} columns={3} />
        </div>
      </div>
    </>
  );
}
