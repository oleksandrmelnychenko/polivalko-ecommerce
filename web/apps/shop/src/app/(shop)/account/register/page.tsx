import type { Metadata } from "next";
import { RegisterScreen } from "@/features/account";

export const metadata: Metadata = { title: "Реєстрація", robots: { index: false, follow: false } };

export default function AccountRegisterPage() {
  return <RegisterScreen />;
}
