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
        <div className="catalog__main">
          <div className="toolbar" aria-hidden="true">
            <p className="toolbar__count skeleton" style={{ width: "10rem" }}>
              &nbsp;
            </p>
            <div className="toolbar__controls">
              <span className="skeleton" style={{ width: "14rem", height: "36px" }} />
              <span className="skeleton" style={{ width: "9rem", height: "36px" }} />
            </div>
          </div>
          <ProductTilesSkeleton count={6} columns={3} />
        </div>
      </div>
    </>
  );
}
