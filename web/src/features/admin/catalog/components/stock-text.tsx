const LOW_STOCK = 3;

export function StockText({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="chip chip--pink">Немає</span>;
  if (stock <= LOW_STOCK) return <span className="chip chip--yellow">Мало · {stock}</span>;
  return <>{stock}</>;
}
