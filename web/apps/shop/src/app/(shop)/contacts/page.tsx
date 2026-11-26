import { ContactsScreen } from "@/features/content/server";
import { seoMetadata } from "@/features/seo";

export const metadata = seoMetadata({
  title: "Контакти магазину в Бучі: адреса й графік",
  description: "Контакти Poli Valko в Бучі: вул. Депутатська, 1-В, ТК «Варшавський». Телефон +38 (073) 818-52-22, графік роботи, маршрут і заявка на послуги.",
  path: "/contacts",
});

export default function ContactsPage() {
  return <ContactsScreen />;
}
