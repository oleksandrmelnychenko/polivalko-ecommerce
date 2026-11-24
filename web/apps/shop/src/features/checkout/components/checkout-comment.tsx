import type { FieldProps } from "../lib/field-props";

export function CheckoutComment({ field, fieldError }: FieldProps) {
  return (
    <details className="co-comment" open={field("comment")["aria-invalid"] || undefined}>
      <summary>Коментар до замовлення</summary>
      <div className="field">
        <label htmlFor="comment" className="visually-hidden">
          Коментар до замовлення
        </label>
        <textarea id="comment" name="comment" rows={2} autoComplete="off" maxLength={1000} placeholder="Наприклад, зручний час для дзвінка…" {...field("comment")} />
        {fieldError("comment")}
      </div>
    </details>
  );
}
