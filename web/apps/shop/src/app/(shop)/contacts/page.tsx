import { ContactsScreen } from "@/features/content/server";
import { seoMetadata } from "@/features/seo";

export const metadata = seoMetadata({
  title: "Контакти",
  description: "Адреса, графік і телефони магазину й послуг Poli Valko.",
  path: "/contacts",
});

export default function ContactsPage() {
  return <ContactsScreen />;
}
