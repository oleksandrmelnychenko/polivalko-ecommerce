"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavLink } from "../lib/nav-links";

export function NavItemLink({ href, label }: NavLink) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <li className="nav-item">
      <Link href={href} className="nav-link" aria-current={current ? "page" : undefined}>
        {label}
      </Link>
    </li>
  );
}
