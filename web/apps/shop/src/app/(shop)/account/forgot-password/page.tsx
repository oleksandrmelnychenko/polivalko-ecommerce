import type { Metadata } from "next";
import { ForgotPasswordScreen } from "@/features/account";

export const metadata: Metadata = { title: "Відновлення пароля", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
