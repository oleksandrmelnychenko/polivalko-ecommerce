import type { ReactNode } from "react";

export type CheckoutOption = { code: string; title: string; icon: ReactNode; notes: string[] };

export function CheckoutOptions({ name, legend, options, value, onChange }: { name: string; legend: string; options: CheckoutOption[]; value: string; onChange: (code: string) => void }) {
  return (
    <fieldset className="co-options">
      <legend className="visually-hidden">{legend}</legend>
      {options.map((option) => (
        <span key={option.code} className="co-option">
          <input type="radio" id={`${name}-${option.code}`} name={name} value={option.code} checked={value === option.code} onChange={() => onChange(option.code)} />
          <label htmlFor={`${name}-${option.code}`}>
            <span className="co-option__icon" aria-hidden="true">
              {option.icon}
            </span>
            <span className="co-option__text">
              <b>{option.title}</b>
              {option.notes.filter(Boolean).map((note, index) => (
                <small key={index}>{note}</small>
              ))}
            </span>
          </label>
        </span>
      ))}
    </fieldset>
  );
}
