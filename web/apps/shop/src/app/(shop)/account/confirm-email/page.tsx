import type { Metadata } from "next";
import { ConfirmEmailScreen } from "@/features/account";
import { customerMailDelivers } from "@/features/content/server";

export const metadata: Metadata = { title: "Підтвердження email", robots: { index: false, follow: false } };

export default function ConfirmEmailPage() {
  return <ConfirmEmailScreen mailDelivers={customerMailDelivers} />;
}
