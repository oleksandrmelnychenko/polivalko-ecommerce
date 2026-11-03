"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout, useStaff } from "@/features/admin/auth";
import { ExternalIcon, LogoutIcon, SearchIcon } from "@/shared/ui/icons";
import { useLinks } from "../hooks/use-nav-links";
import { isCurrent, type Summary } from "../lib/nav";
import { CommandPalette } from "./command-palette";
import { Notifications } from "./notifications";

export function TopBar({ summary }: { summary?: Summary }) {
  const { me } = useStaff();
  const pathname = usePathname();
  const router = useRouter();
  const links = useLinks();
  const all = links.flatMap((g) => g.links);
  const section = all.find((l) => isCurrent(l.href, pathname));
  const initials = me.displayName
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  async function onLogout() {
    await logout();
    router.replace("/admin/login");
  }

  return (
    <header className="admin-top">
      <p className="admin-top__section">{section?.label ?? "Адмінка"}</p>
      <button type="button" className="admin-top__search" onClick={() => window.dispatchEvent(new Event("admin:search"))}>
        <SearchIcon />
        <span>Пошук замовлень, товарів, покупців…</span>
        <span className="kbd" aria-hidden="true">
          Ctrl K
        </span>
      </button>
      <CommandPalette sections={all.map(({ href, label, icon }) => ({ href, label, icon }))} />
      <div className="admin-top__right">
        <Notifications summary={summary} />
        <Link href="/" className="admin-top__icon" target="_blank" aria-label="Відкрити вітрину в новій вкладці" title="Вітрина">
          <ExternalIcon />
        </Link>
        <span className="admin-top__me">
          <span className="admin-avatar" aria-hidden="true">
            {initials || "?"}
          </span>
          <span>
            {me.displayName}
            <span className="admin-top__role">{me.roles.includes("Admin") ? "Адміністратор" : "Менеджер"}</span>
          </span>
        </span>
        <button type="button" className="admin-top__icon" onClick={onLogout} aria-label="Вийти" title="Вийти">
          <LogoutIcon />
        </button>
      </div>
    </header>
  );
}
