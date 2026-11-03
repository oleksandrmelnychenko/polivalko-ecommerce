import type { Errors } from "./types";

export function fieldProps(errors: Errors) {
  const field = (name: string) => ({
    "aria-invalid": Boolean(errors[name]) || undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  const fieldError = (name: string) =>
    errors[name] && (
      <p id={`${name}-error`} className="field__error">
        {errors[name]}
      </p>
    );
  return { field, fieldError };
}

export type FieldProps = ReturnType<typeof fieldProps>;
