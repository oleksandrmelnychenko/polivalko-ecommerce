import { getServiceDirections, servicePath } from "@/features/services/server";
import type { ServiceNavLink } from "./nav-links";

export async function getServiceLinks(): Promise<ServiceNavLink[]> {
  const directions = await getServiceDirections().catch(() => []);
  return directions.map(({ code, slug, name }) => ({ code, href: servicePath(slug), label: name }));
}
