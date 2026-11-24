import { connection } from "next/server";
import { toMenuCategory } from "../lib/menu-category";
import { getCategoryTree, searchProducts } from "@/features/catalog/server";
import { mobilePageLinks, saleLink } from "../lib/nav-links";
import { MobileMenu } from "./mobile-menu";

export async function HeaderMobileMenu() {
  await connection();
  const [categories, sale] = await Promise.all([getCategoryTree().catch(() => []), searchProducts({ onSale: true, pageSize: 1 }).catch(() => null)]);
  return (
    <MobileMenu
      categories={categories.map(toMenuCategory)}
      pages={sale && sale.totalItems > 0 ? [saleLink, ...mobilePageLinks] : mobilePageLinks}
    />
  );
}
