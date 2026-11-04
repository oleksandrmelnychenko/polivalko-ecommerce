import Link from "next/link";
import { ChevronDownIcon } from "@polivalko/shared/ui/icons";

export function NavFallback() {
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
