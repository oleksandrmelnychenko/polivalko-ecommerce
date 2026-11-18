import type { Metadata } from "next";
import { RegisterScreen } from "@/features/account";
import { customerMailDelivers } from "@/features/content/server";

export const metadata: Metadata = { title: "Реєстрація", robots: { index: false, follow: false } };

export default function AccountRegisterPage() {
  return <RegisterScreen mailDelivers={customerMailDelivers} />;
}
