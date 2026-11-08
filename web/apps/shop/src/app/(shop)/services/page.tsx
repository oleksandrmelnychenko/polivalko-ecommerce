import { seoMetadata } from "@/features/seo";
import { ServicesScreen } from "@/features/services/server";

export const metadata = seoMetadata({
  title: "Послуги",
  description: "Ландшафтний дизайн, автополив, озеленення, газони, догляд за садом і обробка рослин.",
  path: "/services",
});

export default function ServicesPage() {
  return <ServicesScreen />;
}
