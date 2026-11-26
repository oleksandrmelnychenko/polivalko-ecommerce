import { connection } from "next/server";
import { getServiceDirections, servicePath } from "@/features/services/server";
import { FooterLinks } from "./footer-links";

const ALL_SERVICES = [{ href: "/services", label: "Усі послуги" }];

export async function FooterServices() {
  await connection();
  const directions = await getServiceDirections().catch(() => []);
  return <FooterLinks links={directions.length > 0 ? directions.map((d) => ({ href: servicePath(d.slug), label: d.name })) : ALL_SERVICES} />;
}
