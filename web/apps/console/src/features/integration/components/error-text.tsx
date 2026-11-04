export function ErrorText({ text, empty = "немає" }: { text: string | null; empty?: string }) {
  if (!text) return <span className="muted">{empty}</span>;
  if (text.length <= 80) return <span className="console-bad">{text}</span>;
  return (
    <details className="console-details">
      <summary className="console-bad">{text.slice(0, 60).trimEnd()}…</summary>
      <pre className="console-pre">{text}</pre>
    </details>
  );
}

export function Failures({ count }: { count: number }) {
  return count > 0 ? <span className="console-bad">{count}</span> : <>0</>;
}
