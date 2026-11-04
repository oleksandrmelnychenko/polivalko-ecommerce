import type { InputHTMLAttributes, ReactNode } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  errors: Record<string, string>;
  help?: ReactNode;
  aside?: ReactNode;
};

export function TextField({ name, label, errors, help, aside, ...input }: TextFieldProps) {
  const id = `account-${name}`;
  const error = errors[name];
  const described = [error && `${id}-error`, help && `${id}-help`].filter(Boolean).join(" ");
  return (
    <div className="field">
      {aside ? (
        <div className="field__row">
          <label htmlFor={id}>{label}</label>
          {aside}
        </div>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      <input id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={described || undefined} {...input} />
      {help && (
        <p id={`${id}-help`} className="field__help">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
