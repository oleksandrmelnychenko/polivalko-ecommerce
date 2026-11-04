import type { Metadata } from "next";
import { LoginScreen } from "@/features/auth";

export const metadata: Metadata = { title: "Вхід" };

export default function LoginPage() {
  return <LoginScreen />;
}
