import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="container">
      <header className="page-head" style={{ paddingBlock: "var(--space-3xl)" }}>
        <Link href="/" className="wordmark">
          Poli<b>Valko</b>
        </Link>
        <h1 style={{ marginTop: "var(--space-2xl)" }}>Сторінку не знайдено</h1>
        <p className="lead">Можливо, товар більше не продається або адреса змінилася.</p>
        <div className="hero__actions">
          <Link href="/catalog" className="btn">
            Перейти до каталогу
          </Link>
        </div>
      </header>
    </main>
  );
}
