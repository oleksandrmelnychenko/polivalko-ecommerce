import { CircleCheckIcon } from "@polivalko/shared/ui/icons";
import { useCart } from "./cart-provider";

export function InCartButton({ name, quantity, className }: { name: string; quantity: number; className: string }) {
  const { open } = useCart();
  return (
    <button type="button" className={className + " cart-purchase cart-purchase--selected"} onClick={open}
      aria-label={`Відкрити кошик: ${name}, ${quantity} шт.`}>
      <CircleCheckIcon /><span>У кошику · {quantity}</span>
    </button>
  );
}
