import Link from "next/link";
import type { ProductDetails } from "@polivalko/shared/api/types";

export function ProductVariants({ variants }: { variants: ProductDetails["variants"] }) {
  return (
    <nav aria-label="Варіанти товару">
      <ul className="variants">
        {variants.map((v) =>
          v.isCurrent ? (
            <li key={v.slug}>
              <span aria-current="true">{v.label}</span>
            </li>
          ) : (
            <li key={v.slug}>
              <Link href={`/product/${v.slug}`} className={v.inStock ? undefined : "is-out"}>
                {v.label}
                {!v.inStock && <span className="visually-hidden"> (немає в наявності)</span>}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
