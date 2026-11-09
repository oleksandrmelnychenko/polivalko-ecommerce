import Link from "next/link";
import { ChevronDownIcon } from "@polivalko/shared/ui/icons";
import { pageLinks, saleLink } from "../lib/nav-links";

export function NavFallback() {
  return (
    <nav className="site-nav" aria-label="Головне меню">
      <ul className="site-nav__list">
        <li className="nav-item">
          <Link href="/catalog" className="nav-link">
            Каталог
            <ChevronDownIcon />
          </Link>
        </li>
        {[saleLink, ...pageLinks].map((link) => (
          <li key={link.href} className="nav-item">
            <Link href={link.href} className="nav-link">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
