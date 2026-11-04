import type { Metadata } from "next";
import { ContactsScreen } from "@/features/content/server";

export const metadata: Metadata = {
  title: "Контакти",
  description: "Адреса, графік, телефони магазину й послуг Poli Valko у Бучі.",
  alternates: { canonical: "/contacts" },
};

export default function ContactsPage() {
  return <ContactsScreen />;
}
