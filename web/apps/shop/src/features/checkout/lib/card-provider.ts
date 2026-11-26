import type { Quote } from "@polivalko/shared/api/types";

type PaymentOption = Quote["deliveryMethods"][number]["paymentMethods"][number];

/** The bank chosen for online payment, or the first one offered. */
export function cardProviderOf(options: PaymentOption[], chosen: string): string | null {
  const providers = options.find((p) => p.code === "card")?.providers ?? [];
  return providers.find((p) => p.code === chosen)?.code ?? providers[0]?.code ?? null;
}
