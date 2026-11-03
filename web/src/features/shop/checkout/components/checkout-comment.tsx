import Link from "next/link";
import type { FieldProps } from "../lib/field-props";

export function CheckoutComment({ field, fieldError }: FieldProps) {
  return (
    <section aria-labelledby="comment-title">
      <h2 id="comment-title">
        <span>4</span> Коментар
      </h2>
      <div className="field">
        <label htmlFor="comment" className="visually-hidden">
          Коментар до замовлення
        </label>
        <textarea id="comment" name="comment" autoComplete="off" maxLength={1000} placeholder="Наприклад, зручний час для дзвінка…" {...field("comment")} />
        {fieldError("comment")}
      </div>
      <label className="consent">
        <input type="checkbox" name="acceptOffer" required {...field("acceptOffer")} />
        <span>
          Погоджуюся з{" "}
          <Link href="/offer" className="link" target="_blank">
            публічною офертою
          </Link>{" "}
          і{" "}
          <Link href="/privacy" className="link" target="_blank">
            політикою приватності
          </Link>
        </span>
      </label>
      {fieldError("acceptOffer")}
    </section>
  );
}
