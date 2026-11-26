import { connection } from "next/server";
import { getServiceLinks } from "../lib/service-links";
import { FooterLinks } from "./footer-links";

const ALL_SERVICES = [{ href: "/services", label: "Усі послуги" }];

export async function FooterServices() {
  await connection();
  const links = await getServiceLinks();
  return <FooterLinks links={links.length > 0 ? links : ALL_SERVICES} />;
}
