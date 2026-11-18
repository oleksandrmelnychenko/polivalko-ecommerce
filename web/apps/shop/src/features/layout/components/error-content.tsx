"use client";

export function ErrorContent({ retry }: { retry: () => void }) {
  return (
    <div className="container">
      <header className="page-head" style={{ paddingBlock: "var(--space-3xl)" }}>
        <h1>Не вдалося завантажити сторінку</h1>
        <p className="lead">Сервіс тимчасово недоступний. Спробуйте ще раз за хвилину.</p>
        <div className="hero__actions">
          <button type="button" onClick={retry} className="btn">
            Спробувати ще раз
          </button>
        </div>
      </header>
    </div>
  );
}
