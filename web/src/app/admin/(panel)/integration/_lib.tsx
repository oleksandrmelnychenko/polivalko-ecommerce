"use client";

/** Текст помилки: короткий показуємо як є, довгий (стек, відповідь API) згортаємо, щоб не розтягувати таблицю. */
export function ErrorText({ text, empty = "немає" }: { text: string | null; empty?: string }) {
  if (!text) return <span className="muted">{empty}</span>;
  if (text.length <= 80) return <span className="admin-bad">{text}</span>;
  return (
    <details className="admin-details">
      <summary className="admin-bad">{text.slice(0, 60).trimEnd()}…</summary>
      <pre className="admin-pre">{text}</pre>
    </details>
  );
}

export function Failures({ count }: { count: number }) {
  return count > 0 ? <span className="admin-bad">{count}</span> : <>0</>;
}
