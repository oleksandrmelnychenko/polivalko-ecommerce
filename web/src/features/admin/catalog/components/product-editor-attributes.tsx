import type { Dispatch, SetStateAction } from "react";
import { FieldError } from "@/shared/admin/form/field-error";
import type { Attribute } from "../lib/types";

export function ProductEditorAttributes({
  attributes,
  setAttributes,
  error,
}: {
  attributes: Attribute[];
  setAttributes: Dispatch<SetStateAction<Attribute[]>>;
  error?: string;
}) {
  return (
    <fieldset className="admin-form" style={{ border: 0, padding: 0 }}>
      <legend className="admin-title" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-xs)" }}>
        Характеристики
      </legend>
      <p className="field__help">Фільтри розділу будуються за назвами, погодженими в налаштуваннях розділу.</p>
      {attributes.map((a, i) => (
        <div key={i} className="attr-row">
          <div className="field">
            <label htmlFor={`attr-name-${i}`}>Назва</label>
            <input id={`attr-name-${i}`} value={a.name} maxLength={100} onChange={(e) => setAttributes((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          </div>
          <div className="field">
            <label htmlFor={`attr-value-${i}`}>Значення</label>
            <input id={`attr-value-${i}`} value={a.value} maxLength={300} onChange={(e) => setAttributes((list) => list.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          </div>
          <button type="button" className="btn btn--small btn--quiet" onClick={() => setAttributes((list) => list.filter((_, j) => j !== i))}>
            Прибрати
          </button>
        </div>
      ))}
      <FieldError id="attributes-error" message={error} />
      <div>
        <button type="button" className="btn btn--small btn--quiet" onClick={() => setAttributes((list) => [...list, { name: "", value: "" }])}>
          Додати характеристику
        </button>
      </div>
    </fieldset>
  );
}
