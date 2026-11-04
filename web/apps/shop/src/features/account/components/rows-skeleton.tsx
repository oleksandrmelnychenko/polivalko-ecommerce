export function RowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="rows-skeleton" aria-busy="true" aria-label="Завантаження…">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}
