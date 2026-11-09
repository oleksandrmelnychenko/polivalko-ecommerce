import { ClipboardIcon } from "@polivalko/shared/ui/icons";
import type { FieldProps } from "../lib/field-props";
import { CheckoutStep } from "./checkout-step";

export function CheckoutComment({ field, fieldError }: FieldProps) {
  return (
    <CheckoutStep id="comment-title" icon={<ClipboardIcon />} title="Коментар" hint="Необов'язково">
      <div className="field">
        <label htmlFor="comment" className="visually-hidden">
          Коментар до замовлення
        </label>
        <textarea id="comment" name="comment" rows={3} autoComplete="off" maxLength={1000} placeholder="Наприклад, зручний час для дзвінка…" {...field("comment")} />
        {fieldError("comment")}
      </div>
    </CheckoutStep>
  );
}
