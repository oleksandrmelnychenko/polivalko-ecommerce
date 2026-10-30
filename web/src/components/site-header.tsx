import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import type { ProductListItem } from "@/lib/api/server";
import { getCategoryTree, getServiceDirections, searchProducts } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { thumb } from "@/lib/images";
import { categoryPhotos } from "@/lib/stand-in-photos";
import { CartButton } from "./cart-button";
import { ChevronDownIcon, MenuIcon } from "./icons";
import { MainNav } from "./main-nav";
import { MobileMenu } from "./mobile-menu";
import { SearchButton } from "./search-panel";

type NavLink = { href: string; label: string };

const homeLinks: NavLink[] = [
  { href: "/#offers-title", label: "Знижки" },
  { href: "/#collection-title", label: "Рекомендовані товари" },
  { href: "/#sections-title", label: "Розділи каталогу" },
  { href: "/#services-title", label: "Послуги для саду" },
  { href: "/#steps-title", label: "Як замовити" },
  { href: "/#visit-title", label: "Магазин у Бучі" },
];

const buyerLinks: NavLink[] = [
  { href: "/payment-delivery", label: "Доставка й оплата" },
  { href: "/returns", label: "Повернення" },
  { href: "/offer", label: "Публічна оферта" },
  { href: "/privacy", label: "Політика приватності" },
];

const contactLinks: NavLink[] = [
  { href: "/contacts", label: "Контакти й маршрут" },
  { href: "/payment-delivery", label: "Самовивіз у Бучі" },
  { href: "/services", label: "Замовити послугу" },
];

/**
 * Шапка: біла смуга 96 px з тонким розділювачем, знак у рамці, меню зі стрілками.
 * Підменю відкриваються при наведенні: «Каталог» — мегаменю на всю ширину з колонками, решта — випадні списки.
 */
export function SiteHeader() {
  return (
    <>
      <header className="site-header">
        <div className="container site-header__bar">
          {/* Логотип і брендову графіку надає замовник (розділ 3 ТЗ); поки що текстовий знак у рамці. */}
          <Link href="/" className="logo" translate="no">
            PoliValko
          </Link>
          <Suspense fallback={<NavFallback />}>
            <HeaderNav />
          </Suspense>
          <div className="site-header__actions">
            <SearchButton />
            <CartButton />
            <button type="button" className="icon-btn icon-btn--chrome site-header__menu" popoverTarget="mobile-menu" aria-label="Меню й каталог">
              <MenuIcon />
            </button>
          </div>
        </div>
      </header>
      <Suspense fallback={null}>
        <HeaderMobileMenu />
      </Suspense>
    </>
  );
}

function NavFallback() {
  return (
    <nav className="site-nav" aria-label="Головне меню">
      <ul className="site-nav__list">
        {[
          ["/", "Головна"],
          ["/catalog", "Каталог"],
          ["/services", "Послуги"],
          ["/payment-delivery", "Покупцям"],
          ["/contacts", "Контакти"],
        ].map(([href, label]) => (
          <li key={href} className="nav-item">
            <Link href={href} className="nav-link">
              {label}
              <ChevronDownIcon />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

async function HeaderNav() {
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

function NavDropdown({ href, label, links }: { href: string; label: string; links: NavLink[] }) {
  return (
    <li className="nav-item">
      <Link href={href} className="nav-link" aria-haspopup="true">
        {label}
        <ChevronDownIcon />
      </Link>
      <ul className="sub sub--drop">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

function MegaColumn({ title, links }: { title: string; links: NavLink[] }) {
  return (
    <div className="mega-col">
      <p className="mega-col__title">{title}</p>
      <ul>
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Остання колонка мегаменю, як у референсі: фото товару — тут актуальна пропозиція зі знижкою. */
function MegaProduct({ product }: { product: ProductListItem }) {
  return (
    <div className="mega-col mega-col--product">
      <p className="mega-col__title">Зі знижкою</p>
      <Link href={`/product/${product.slug}`} className="mega-product">
        {product.imageUrl && <img src={thumb(product.imageUrl, 250)} alt="" width={120} height={120} loading="lazy" />}
        <span className="mega-product__name">{product.name}</span>
        <span className="mega-product__price">
          {product.oldPrice && <s>{formatMoney(product.oldPrice)}</s>} {formatMoney(product.price)}
        </span>
      </Link>
    </div>
  );
}

async function HeaderMobileMenu() {
  await connection();
  const categories = await getCategoryTree();
  return (
    <MobileMenu
      categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, photo: categoryPhotos[c.slug]?.url ?? null }))}
      pages={[...buyerLinks, { href: "/services", label: "Послуги для саду" }, { href: "/contacts", label: "Контакти" }]}
    />
  );
}
