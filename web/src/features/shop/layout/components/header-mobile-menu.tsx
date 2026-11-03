import { connection } from "next/server";
import { getCategoryTree } from "@/features/shop/catalog/server";
import { categoryPhotos } from "@/shared/lib/stand-in-photos";
import { buyerLinks } from "../lib/nav-links";
import { MobileMenu } from "./mobile-menu";

export async function HeaderMobileMenu() {
  await connection();
  const categories = await getCategoryTree();
  return (
    <MobileMenu
      categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, photo: categoryPhotos[c.slug]?.url ?? null }))}
      pages={[...buyerLinks, { href: "/services", label: "Послуги для саду" }, { href: "/contacts", label: "Контакти" }]}
    />
  );
}
