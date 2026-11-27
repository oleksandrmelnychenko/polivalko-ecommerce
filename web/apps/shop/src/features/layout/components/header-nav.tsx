import { getServiceLinks } from "../lib/service-links";
import { connection } from "next/server";
import { getCategoryTree, summarizeProducts } from "@/features/catalog/server";
import { mobilePageLinks, pageLinks, saleLink } from "../lib/nav-links";
import { MainNav } from "./main-nav";
import { toMenuCategory } from "../lib/menu-category";
import { NavFallback } from "./nav-fallback";

export async function HeaderNav() {
  await connection();
  const [categories, sale, services] = await Promise.all([getCategoryTree().catch(() => null), summarizeProducts({ onSale: true }).catch(() => null), getServiceLinks()]);
  if (!categories) return <NavFallback />;
  const hasSale = Boolean(sale && sale.totalItems > 0);
  const links = hasSale ? [saleLink, ...pageLinks] : pageLinks;
  const mobilePages = hasSale ? [saleLink, ...mobilePageLinks] : mobilePageLinks;

  return <MainNav categories={categories.map(toMenuCategory)} links={links} mobilePages={mobilePages} services={services} />;
}
