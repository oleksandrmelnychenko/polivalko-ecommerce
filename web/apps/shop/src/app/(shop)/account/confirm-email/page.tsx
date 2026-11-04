import type { Metadata } from "next";
import { ConfirmEmailScreen } from "@/features/account";

export const metadata: Metadata = { title: "Підтвердження email", robots: { index: false, follow: false } };

export default function ConfirmEmailPage() {
  return <ConfirmEmailScreen />;
}
