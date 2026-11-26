import { getServiceLinks } from "../lib/service-links";
import { connection } from "next/server";
import { getCategoryTree, searchProducts } from "@/features/catalog/server";
import { pageLinks, saleLink } from "../lib/nav-links";
import { MainNav } from "./main-nav";
import { toMenuCategory } from "../lib/menu-category";
import { NavFallback } from "./nav-fallback";

export async function HeaderNav() {
  await connection();
  const [categories, sale, services] = await Promise.all([getCategoryTree().catch(() => null), searchProducts({ onSale: true, sort: "price_asc", pageSize: 1 }).catch(() => null), getServiceLinks()]);
  if (!categories) return <NavFallback />;
  const links = sale && sale.totalItems > 0 ? [saleLink, ...pageLinks] : pageLinks;

  return <MainNav categories={categories.map(toMenuCategory)} links={links} services={services} />;
}
