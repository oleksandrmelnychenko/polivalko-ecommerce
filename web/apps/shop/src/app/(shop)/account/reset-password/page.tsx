import type { Metadata } from "next";
import { ResetPasswordScreen } from "@/features/account";

export const metadata: Metadata = { title: "Новий пароль", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <ResetPasswordScreen />;
}
