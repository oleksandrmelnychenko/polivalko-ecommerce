import { connection } from "next/server";
import { deliveryFacts, type DeliveryFacts } from "@/shared/lib/delivery-facts";
import { getContacts, getCustomerMail, getDeliveryMethods } from "../api/server";

export async function customerMailDelivers(): Promise<boolean> {
  await connection();
  try {
    return (await getCustomerMail()).delivers;
  } catch {
    return false;
  }
}

export async function storePhone(): Promise<string | null> {
  await connection();
  try {
    return (await getContacts())?.storePhone?.trim() || null;
  } catch {
    return null;
  }
}

export async function enabledDeliveryFacts(): Promise<DeliveryFacts | null> {
  await connection();
  try {
    const methods = await getDeliveryMethods();
    return methods.length > 0 ? deliveryFacts(methods) : null;
  } catch {
    return null;
  }
}
