import type { ProductDetails } from "@polivalko/shared/api/types";
import { PhoneIcon } from "@polivalko/shared/ui/icons";
import { askLine, telHref } from "../lib/ask";

function AskLine({ line, number }: { line: string; number?: string }) {
  return (
    <p className="buybox__note buybox__ask">
      <PhoneIcon />
      <span>
        {line}:{" "}
        {number ? (
          <a href={telHref(number)} translate="no">{number}</a>
        ) : (
          // Holds the place of the number, so the line has its final height before the number arrives.
          <span className="buybox__ask-wait" aria-hidden="true">+38 (000) 000-00-00</span>
        )}
      </span>
    </p>
  );
}

/** The line while the shop's phone is on its way: same text and size, so nothing below it moves when the number lands. */
export function ProductAskPending({ product }: { product: ProductDetails }) {
  const line = askLine(product);
  return line ? <AskLine line={line} /> : null;
}

/**
 * The next step on a product that cannot be bought on the site: without it the page ended at a disabled button.
 * The shop's phone comes from the console, so the number streams in after the product itself.
 */
export async function ProductAsk({ product, phone }: { product: ProductDetails; phone: () => Promise<string | null> }) {
  const line = askLine(product);
  if (!line) return null;
  const number = await phone();
  return number ? <AskLine line={line} number={number} /> : null;
}
