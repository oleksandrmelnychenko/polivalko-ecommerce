import type { Metadata } from "next";
import { LoginScreen } from "@/features/account";

export const metadata: Metadata = { title: "Вхід до кабінету", robots: { index: false, follow: false } };

export default function AccountLoginPage() {
  return <LoginScreen />;
}
