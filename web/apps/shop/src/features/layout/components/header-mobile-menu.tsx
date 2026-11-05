import { connection } from "next/server";
import { categoryPhotoUrl } from "@/features/catalog";
import { getCategoryTree } from "@/features/catalog/server";
import { buyerLinks } from "../lib/nav-links";
import { MobileMenu } from "./mobile-menu";

export async function HeaderMobileMenu() {
  await connection();
  const categories = await getCategoryTree();
  return (
    <MobileMenu
      categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, photo: categoryPhotoUrl(c) }))}
      pages={[...buyerLinks, { href: "/services", label: "Послуги для саду" }, { href: "/contacts", label: "Контакти" }]}
    />
  );
}
