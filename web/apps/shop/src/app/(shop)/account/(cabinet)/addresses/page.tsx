import type { Metadata } from "next";
import { CabinetContent, AddressesScreen } from "@/features/account";

export const metadata: Metadata = { title: "Мої адреси", robots: { index: false, follow: false } };

export default function AccountAddressesPage() {
  return (
    <CabinetContent>
      <AddressesScreen />
    </CabinetContent>
  );
}
