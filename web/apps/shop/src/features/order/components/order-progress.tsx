import type { Order } from "@polivalko/shared/api/types";
import { formatDateTime } from "@polivalko/shared/lib/format";
import { CheckIcon } from "@polivalko/shared/ui/icons";
import { orderSteps } from "../lib/order-view";

export function OrderProgress({ order }: { order: Order }) {
  const steps = orderSteps(order);
  if (!steps) return null;
  return (
    <ol className="order-steps" aria-label="Стан замовлення">
      {steps.map((step, i) => (
        <li key={step.key} className={`order-step order-step--${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
          <span className="order-step__dot" aria-hidden="true">
            {step.state === "done" ? <CheckIcon /> : i + 1}
          </span>
          <span className="order-step__label">{step.label}</span>
          {step.at && (
            <time className="order-step__at" dateTime={step.at}>
              {formatDateTime(step.at)}
            </time>
          )}
          {step.hint && <span className="order-step__hint">{step.hint}</span>}
        </li>
      ))}
    </ol>
  );
}
