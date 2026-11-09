import Link from "next/link";

export function NotFoundContent() {
  return (
    <div className="container">
      <header className="page-head" style={{ paddingBlock: "var(--space-3xl)" }}>
        <h1>Сторінку не знайдено</h1>
        <p className="lead">Можливо, товар більше не продається або адреса змінилася.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
          <Link href="/catalog" className="btn">
            Перейти до каталогу
          </Link>
          <Link href="/" className="btn btn--quiet">
            На головну
          </Link>
        </div>
      </header>
    </div>
  );
}
