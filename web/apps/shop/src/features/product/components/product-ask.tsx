import type { ProductDetails } from "@polivalko/shared/api/types";
import { PhoneIcon } from "@polivalko/shared/ui/icons";
import { askLine, telHref } from "../lib/ask";

/**
 * The next step on a product that cannot be bought on the site: without it the page ended at a disabled button.
 * The shop's phone comes from the console, so the line streams in after the product itself.
 */
export async function ProductAsk({ product, phone }: { product: ProductDetails; phone: () => Promise<string | null> }) {
  const line = askLine(product);
  if (!line) return null;
  const number = await phone();
  if (!number) return null;
  return (
    <p className="buybox__note buybox__ask">
      <PhoneIcon />
      <span>
        {line}: <a href={telHref(number)} translate="no">{number}</a>
      </span>
    </p>
  );
}
