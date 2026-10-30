"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container">
      <header className="page-head" style={{ paddingBlock: "var(--space-3xl)" }}>
        <h1>Не вдалося завантажити сторінку</h1>
        <p className="lead">Сервіс тимчасово недоступний. Спробуйте ще раз за хвилину.</p>
        <div className="hero__actions">
          <button type="button" onClick={reset} className="btn">
            Спробувати ще раз
          </button>
        </div>
      </header>
    </div>
  );
}
