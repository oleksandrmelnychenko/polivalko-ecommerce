import { connection } from "next/server";
import { categoryPhotoUrl } from "@/features/catalog";
import { getCategoryTree, searchProducts } from "@/features/catalog/server";
import { mobilePageLinks, saleLink } from "../lib/nav-links";
import { MobileMenu } from "./mobile-menu";

export async function HeaderMobileMenu() {
  await connection();
  const [categories, sale] = await Promise.all([getCategoryTree(), searchProducts({ onSale: true, pageSize: 1 })]);
  return (
    <MobileMenu
      categories={categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        photo: categoryPhotoUrl(c),
        children: (c.children ?? []).map((child) => ({ id: child.id, slug: child.slug, name: child.name })),
      }))}
      pages={sale && sale.totalItems > 0 ? [saleLink, ...mobilePageLinks] : mobilePageLinks}
    />
  );
}
