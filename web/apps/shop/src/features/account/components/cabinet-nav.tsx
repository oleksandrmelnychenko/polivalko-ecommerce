"use client";

import { Breadcrumbs } from "@/shared/ui/breadcrumbs";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HeartIcon } from "@/features/favorites";
import { ClipboardIcon, LogoutIcon, PinIcon, UserIcon } from "@polivalko/shared/ui/icons";

const items: { href: string; label: string; icon: ReactNode; match: (path: string) => boolean }[] = [
  { href: "/account/orders", label: "Замовлення", icon: <ClipboardIcon />, match: (p) => p === "/account" || p.startsWith("/account/orders") },
  { href: "/account/favorites", label: "Обране", icon: <HeartIcon />, match: (p) => p.startsWith("/account/favorites") },
  { href: "/account/addresses", label: "Адреси", icon: <PinIcon />, match: (p) => p.startsWith("/account/addresses") },
  { href: "/account/profile", label: "Профіль", icon: <UserIcon />, match: (p) => p.startsWith("/account/profile") },
];

export function CabinetBreadcrumbs({ pathname }: { pathname: string }) {
  if (pathname === "/account") return <Breadcrumbs current="Особистий кабінет" />;
  const parents = [{ name: "Особистий кабінет", path: "/account" }];
  if (pathname.startsWith("/account/orders/")) {
    parents.push({ name: "Замовлення", path: "/account/orders" });
    return <Breadcrumbs current={`Замовлення №${pathname.split("/").at(-1)}`} parents={parents} />;
  }
  return <Breadcrumbs current={items.find(item => item.match(pathname))?.label ?? "Кабінет"} parents={parents} />;
}

export function CabinetNav({ pathname, onLogout }: { pathname: string; onLogout: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const list = nav.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current || list.scrollWidth <= list.clientWidth) return;
    const offset = current.getBoundingClientRect().left - list.getBoundingClientRect().left;
    list.scrollLeft += offset - (list.clientWidth - current.offsetWidth) / 2;
  }, [pathname]);

  async function logout() {
    setBusy(true);
    try {
      await onLogout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <nav ref={nav} className="cabinet-nav" aria-label="Розділи кабінету">
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} aria-current={item.match(pathname) ? "page" : undefined}>
              {item.icon}
              {item.label}
            </Link>
          </li>
        ))}
        <li>
          <button type="button" onClick={logout} disabled={busy} aria-busy={busy}>
            <LogoutIcon />
            Вийти
          </button>
        </li>
      </ul>
    </nav>
  );
}
