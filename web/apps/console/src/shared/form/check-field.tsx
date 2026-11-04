"use client";

export function CheckField({
  id,
  label,
  checked,
  onChange,
  errors,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  errors?: string[];
}) {
  const errorId = errors?.length ? `${id}-error` : undefined;
  return (
    <div className="console-check">
      <label className="check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={errorId}
        />
        {label}
      </label>
      {errors?.length ? (
        <p id={errorId} className="field__error">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
