import { connection } from "next/server";
import { getServiceDirections } from "@/features/services/server";
import { FooterLinks } from "./footer-links";

export async function FooterServices() {
  await connection();
  const directions = await getServiceDirections();
  return <FooterLinks links={directions.slice(0, 5).map((d) => ({ href: "/services", label: d.name }))} />;
}
