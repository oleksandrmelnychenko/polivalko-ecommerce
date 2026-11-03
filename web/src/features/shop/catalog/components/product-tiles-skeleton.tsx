export function ProductTilesSkeleton({ count = 8, columns }: { count?: number; columns?: 2 | 3 }) {
  return (
    <ul className={columns ? `tiles tiles--${columns}` : "tiles"} aria-busy="true" aria-label="Завантаження товарів…">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="tile">
          <div className="tile__photo skeleton" />
          <div className="tile__body">
            <div className="skeleton" style={{ height: "var(--space-lg)" }} />
            <div className="skeleton" style={{ height: "var(--space-xl)", width: "50%", marginInline: "auto" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
