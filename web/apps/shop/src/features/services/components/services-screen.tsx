import { connection } from "next/server";
import { Suspense } from "react";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { getServiceDirections } from "../api/server";
import { ServiceGallery } from "./service-gallery";
import { otherServicesGroup, serviceGroups as groups } from "../lib/service-groups";


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
  const catalogue = [...sections, { ...otherServicesGroup, services: other }]
    .filter(group => group.services.length);

  return <ServiceGallery groups={catalogue} />;
}
