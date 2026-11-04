export default function NotFound() {
  const site = process.env.SITE_URL;
  return (
    <main id="main" className="container">
      <header className="page-head" style={{ paddingBlock: "var(--space-3xl)" }}>
        <a href={`${site}/`} className="wordmark">
          Poli<b>Valko</b>
        </a>
        <h1 style={{ marginTop: "var(--space-2xl)" }}>Сторінку не знайдено</h1>
        <p className="lead">Можливо, товар більше не продається або адреса змінилася.</p>
        <div className="hero__actions">
          <a href={`${site}/catalog`} className="btn">
            Перейти до каталогу
          </a>
        </div>
      </header>
    </main>
  );
}
