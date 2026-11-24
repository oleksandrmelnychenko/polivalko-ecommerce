import { connection } from "next/server";
import { getCategoryTree, searchProducts } from "@/features/catalog/server";
import { pageLinks, saleLink } from "../lib/nav-links";
import { MainNav } from "./main-nav";
import { toMenuCategory } from "../lib/menu-category";
import { NavFallback } from "./nav-fallback";
import { NavItemLink } from "./nav-item-link";

export async function HeaderNav() {
  await connection();
  const [categories, sale] = await Promise.all([getCategoryTree().catch(() => null), searchProducts({ onSale: true, pageSize: 1 }).catch(() => null)]);
  if (!categories) return <NavFallback />;
  const links = sale && sale.totalItems > 0 ? [saleLink, ...pageLinks] : pageLinks;

  return (
    <MainNav categories={categories.map(toMenuCategory)}>
      {links.map((link) => (
        <NavItemLink key={link.href} {...link} />
      ))}
    </MainNav>
  );
}
