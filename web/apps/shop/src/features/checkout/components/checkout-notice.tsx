import type { Notice } from "../lib/types";

export function CheckoutNotice({ notice }: { notice: Notice }) {
  return (
    <div className={notice.kind === "error" ? "notice notice--error" : "notice"} role="alert">
      <strong>{notice.title}</strong>
      {notice.text}
      {notice.items && (
        <ul>
          {notice.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
