import { serviceIcon } from "@polivalko/shared/ui/service-icon";
import Link from "@/shared/ui/idle-link";
import type { ServiceNavLink } from "../lib/nav-links";

export function ServiceMenuLinks({ services, pathname }: { services: ServiceNavLink[]; pathname: string }) {
  return (
    <ul className="service-menu-links">
      {services.map(({ code, href, label }) => {
        const Icon = serviceIcon(code);
        return (
          <li key={code}>
            <Link href={href} aria-current={pathname === href ? "page" : undefined}>
              <span className="menu-category-symbol" aria-hidden="true"><Icon size={17} stroke={1.7} /></span>
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
