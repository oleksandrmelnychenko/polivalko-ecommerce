import type { Status } from "../lib/form-status";

export function FormStatus({ status }: { status: Status }) {
  return (
    <div className="form-status" aria-live="polite" aria-atomic="true">
      {status && (
        <p className={status.kind === "error" ? "notice notice--error" : status.kind === "ok" ? "notice notice--ok" : "notice"}>
          <strong>{status.title}</strong>
          {status.text}
        </p>
      )}
    </div>
  );
}
