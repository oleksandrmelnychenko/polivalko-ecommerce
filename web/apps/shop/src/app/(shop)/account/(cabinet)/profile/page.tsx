import type { Metadata } from "next";
import { CabinetContent, ProfileScreen } from "@/features/account";

export const metadata: Metadata = { title: "Профіль", robots: { index: false, follow: false } };

export default function AccountProfilePage() {
  return (
    <CabinetContent>
      <ProfileScreen />
    </CabinetContent>
  );
}
