import { IconTrash } from "@tabler/icons-react";

export function RemoveCartItem({ name, onRemove }: { name: string; onRemove: () => void }) {
  const label = `Видалити з кошика: ${name}`;
  return <button type="button" className="cart-line__remove" onClick={onRemove} aria-label={label} title={label}>
    <IconTrash size={18} stroke={1.7} aria-hidden="true" />
  </button>;
}
