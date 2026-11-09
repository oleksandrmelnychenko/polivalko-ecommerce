import Link from "next/link";
import { connection } from "next/server";
import { getCategoryTree, searchProducts } from "@/features/catalog/server";
import { ArrowRightIcon, ChevronDownIcon } from "@polivalko/shared/ui/icons";
import { pageLinks, saleLink } from "../lib/nav-links";
import { MainNav } from "./main-nav";
import { MegaColumn } from "./mega-column";
import { NavItemLink } from "./nav-item-link";

export async function HeaderNav() {
  await connection();
  const [categories, sale] = await Promise.all([getCategoryTree(), searchProducts({ onSale: true, pageSize: 1 })]);
  const links = sale && sale.totalItems > 0 ? [saleLink, ...pageLinks] : pageLinks;

  return (
    <MainNav>
      <li className="nav-item nav-item--mega">
        <Link href="/catalog" className="nav-link" aria-haspopup="true">
          Каталог
          <ChevronDownIcon />
        </Link>
        <div className="sub sub--mega">
          {categories.map((c) => (
            <MegaColumn
              key={c.id}
              title={c.name}
              href={`/catalog/${c.slug}`}
              links={(c.children ?? []).map((child) => ({ href: `/catalog/${child.slug}`, label: child.name }))}
            />
          ))}
          <p className="mega-all">
            <Link href="/catalog">
              Увесь каталог
              <ArrowRightIcon />
            </Link>
          </p>
        </div>
      </li>
      {links.map((link) => (
        <NavItemLink key={link.href} {...link} />
      ))}
    </MainNav>
  );
}
