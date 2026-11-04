import type { Status } from "./form-status";

export function repeatStatus(added: number, total: number, missing: string[], reduced: string[]): Status {
  if (added === 0) return { kind: "error", title: "Цих товарів зараз немає в наявності", text: "Подивіться схожі товари в каталозі." };
  const parts = [
    missing.length > 0 && `Немає в наявності: ${missing.join(", ")}.`,
    reduced.length > 0 && `Менше, ніж у замовленні, бо більше немає на складі: ${reduced.join(", ")}.`,
  ].filter(Boolean);
  if (parts.length === 0) return { kind: "ok", title: "Товари в кошику", text: "Перевірте кількість і оформлюйте замовлення." };
  return { kind: "info", title: `Додали в кошик ${added} з ${total}`, text: parts.join(" ") };
}
