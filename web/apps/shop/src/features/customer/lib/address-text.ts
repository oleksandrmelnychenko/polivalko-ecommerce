import type { CustomerAddress } from "./types";

export function addressPlace(a: CustomerAddress): string {
  if (a.method === "nova_poshta_courier" && a.address) {
    const { street, house, apartment } = a.address;
    return `${street}, ${house}${apartment ? `, кв. ${apartment}` : ""}`;
  }
  return a.warehouseName ?? "Відділення Нової пошти";
}

export function addressTitle(a: CustomerAddress): string {
  return a.label || (a.method === "nova_poshta_courier" ? "Кур'єр Нової пошти" : "Нова пошта");
}
