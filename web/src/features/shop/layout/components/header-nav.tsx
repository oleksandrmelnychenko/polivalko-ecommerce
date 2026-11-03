import Link from "next/link";
import { connection } from "next/server";
import { getCategoryTree, searchProducts } from "@/features/shop/catalog/server";
import { getServiceDirections } from "@/features/shop/services/server";
import { ChevronDownIcon } from "@/shared/ui/icons";
import { buyerLinks, contactLinks, homeLinks } from "../lib/nav-links";
import { MainNav } from "./main-nav";
import { MegaColumn } from "./mega-column";
import { MegaProduct } from "./mega-product";
import { NavDropdown } from "./nav-dropdown";

export async function HeaderNav() {
  await connection();
  const [categories, directions, sale] = await Promise.all([getCategoryTree(), getServiceDirections(), searchProducts({ onSale: true, inStock: true, sort: "price_desc", pageSize: 1 })]);
  const half = Math.ceil(categories.length / 2);
  const toLinks = (list: typeof categories) => list.map((c) => ({ href: `/catalog/${c.slug}`, label: c.name }));
  const featured = sale?.items[0];

  return (
    <MainNav>
      <NavDropdown href="/" label="Головна" links={homeLinks} />
      <li className="nav-item nav-item--mega">
        <Link href="/catalog" className="nav-link" aria-haspopup="true">
          Каталог
          <ChevronDownIcon />
        </Link>
        <div className="sub sub--mega">
          <MegaColumn title="Розділи" links={toLinks(categories.slice(0, half))} />
          <MegaColumn title="Ще розділи" links={toLinks(categories.slice(half))} />
          <MegaColumn
            title="Популярне"
            links={[
              { href: "/#offers-title", label: "Товари зі знижкою" },
              { href: "/#collection-title", label: "Рекомендовані товари" },
              { href: "/catalog", label: "Увесь каталог" },
            ]}
          />
          {featured ? <MegaProduct product={featured} /> : <MegaColumn title="Покупцям" links={buyerLinks} />}
        </div>
      </li>
      <NavDropdown href="/services" label="Послуги" links={directions.map((d) => ({ href: "/services", label: d.name }))} />
      <NavDropdown href="/payment-delivery" label="Покупцям" links={buyerLinks} />
      <NavDropdown href="/contacts" label="Контакти" links={contactLinks} />
    </MainNav>
  );
}
