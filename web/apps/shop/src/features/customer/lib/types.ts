import type { components } from "@polivalko/shared/api/schema";

type S = components["schemas"];
export type CustomerMe = S["CustomerMeDto"];
export type CustomerAddress = S["CustomerAddressDto"];
export type SaveAddressRequest = S["SaveCustomerAddressRequest"];
export type Session = { status: "unknown" | "guest" | "signedIn"; me: CustomerMe | null };
