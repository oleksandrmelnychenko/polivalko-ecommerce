import { getServiceLinks } from "../lib/service-links";
import { connection } from "next/server";
import { toMenuCategory } from "../lib/menu-category";
import { getCategoryTree, searchProducts } from "@/features/catalog/server";
import { mobilePageLinks, saleLink } from "../lib/nav-links";
import { MobileMenu } from "./mobile-menu";

export async function HeaderMobileMenu() {
  await connection();
  const [categories, sale, services] = await Promise.all([getCategoryTree().catch(() => []), searchProducts({ onSale: true, sort: "price_asc", pageSize: 1 }).catch(() => null), getServiceLinks()]);
  return (
    <MobileMenu
      categories={categories.map(toMenuCategory)}
      services={services}
      pages={sale && sale.totalItems > 0 ? [saleLink, ...mobilePageLinks] : mobilePageLinks}
    />
  );
}
