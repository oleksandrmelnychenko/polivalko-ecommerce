import { ContactsScreen } from "@/features/content/server";
import { seoMetadata } from "@/features/seo";

export const metadata = seoMetadata({
  title: "Контакти",
  description: "Адреса, графік, телефони магазину й послуг Poli Valko у Бучі.",
  path: "/contacts",
});

export default function ContactsPage() {
  return <ContactsScreen />;
}
