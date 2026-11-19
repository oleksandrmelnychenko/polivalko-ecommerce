"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon, PhoneIcon, StoreIcon, UserIcon } from "@polivalko/shared/ui/icons";
import { CompareIcon } from "@/features/compare";

const links = [
  { href: "/", label: "Головна", Icon: StoreIcon },
  { href: "/catalog", label: "Каталог", Icon: GridIcon },
  { href: "/compare", label: "Порівняння", Icon: CompareIcon },
  { href: "/contacts", label: "Контакти", Icon: PhoneIcon },
  { href: "/account", label: "Профіль", Icon: UserIcon },
];

export function MobileDock() {
  const pathname = usePathname();
  return <nav className="mobile-dock" aria-label="Мобільна навігація">{links.map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={(href === "/" ? pathname === "/" : pathname.startsWith(href)) ? "page" : undefined}><Icon /><span>{label}</span></Link>)}</nav>;
}
