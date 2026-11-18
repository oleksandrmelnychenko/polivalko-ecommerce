export type DeliveryFacts = { branch: boolean; courier: boolean; pickup: boolean; payments: string[] };

type MethodLike = { code: string; paymentMethods: { code: string }[] };

export function deliveryFacts(methods: MethodLike[]): DeliveryFacts {
  const has = (code: string) => methods.some((method) => method.code === code);
  return {
    branch: has("nova_poshta"),
    courier: has("nova_poshta_courier"),
    pickup: has("pickup"),
    payments: [...new Set(methods.flatMap((method) => method.paymentMethods.map((payment) => payment.code)))],
  };
}

export function joinOr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} або ${items[items.length - 1]}`;
}

export function carrierPlaces(facts: DeliveryFacts): string {
  return joinOr([...(facts.branch ? ["відділення", "поштомат"] : []), ...(facts.courier ? ["кур'єр"] : [])]);
}

export function paymentWords(facts: DeliveryFacts, words: Record<string, string>): string {
  return joinOr(facts.payments.map((code) => words[code]).filter(Boolean));
}
