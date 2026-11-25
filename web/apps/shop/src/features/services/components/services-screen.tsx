import { connection } from "next/server";
import { Suspense } from "react";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { getServiceDirections } from "../api/server";
import { ServiceGallery } from "./service-gallery";

const groups = [
  { key: "landscape", label: "Облаштування", title: "Облаштування ділянки", photo: "/brand/garden-services.webp", codes: ["landscape-design", "greening", "lawns"] },
  { key: "irrigation", label: "Автополив", title: "Системи поливу", photo: "/brand/service-irrigation.webp", codes: ["irrigation-installation", "irrigation-service"] },
  { key: "care", label: "Догляд", title: "Догляд за рослинами", photo: "/brand/service-planting.webp", codes: ["garden-care", "plant-treatment"] },
];

export function ServicesScreen() {
  return (
    <div className="container garden-services">
      <Breadcrumbs current="Послуги для саду" />
      <JsonLd data={breadcrumbJsonLd([{ name: "Послуги для саду", path: "/services" }])} />
      <Suspense fallback={<div className="skeleton garden-cover-placeholder" />}>
        <ServicesContent />
      </Suspense>
    </div>
  );
}

async function ServicesContent() {
  await connection();
  const directions = await getServiceDirections();
  const sections = groups.map(group => ({
    ...group,
    services: directions.filter(direction => group.codes.includes(direction.code)),
  }));
  const other = directions.filter(direction => !groups.some(group => group.codes.includes(direction.code)));
  const catalogue = [...sections, { key: "other", label: "Інші роботи", title: "Інші садові роботи", photo: "/brand/garden-services.webp", services: other }]
    .filter(group => group.services.length);

  return <ServiceGallery groups={catalogue} />;
}
