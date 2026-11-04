import type { ReactNode } from "react";

export type FieldA11y = { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

export function Field({
  id,
  label,
  help,
  errors,
  children,
}: {
  id: string;
  label: string;
  help?: ReactNode;
  errors?: string[];
  children: (a11y: FieldA11y) => ReactNode;
}) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-invalid": errorId ? true : undefined, "aria-describedby": describedBy })}
      {errors?.length ? (
        <p id={errorId} className="field__error">
          {errors.join(" ")}
        </p>
      ) : null}
      {help && (
        <p id={helpId} className="field__help">
          {help}
        </p>
      )}
    </div>
  );
}
