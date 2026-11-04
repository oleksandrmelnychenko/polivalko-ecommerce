"use client";

import { usePathname, useRouter } from "next/navigation";
import { logout, useStaff } from "@/features/auth";
import { siteUrl } from "@/shared/site-url";
import { ExternalIcon, LogoutIcon, SearchIcon } from "@polivalko/shared/ui/icons";
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
    router.replace("/login");
  }

  return (
    <header className="console-top">
      <p className="console-top__section">{section?.label ?? "Консоль"}</p>
      <button type="button" className="console-top__search" onClick={() => window.dispatchEvent(new Event("console:search"))}>
        <SearchIcon />
        <span>Пошук замовлень, товарів, покупців…</span>
        <span className="kbd" aria-hidden="true">
          Ctrl K
        </span>
      </button>
      <CommandPalette sections={all.map(({ href, label, icon }) => ({ href, label, icon }))} />
      <div className="console-top__right">
        <Notifications summary={summary} />
        <a href={siteUrl("/")} className="console-top__icon" target="_blank" aria-label="Відкрити вітрину в новій вкладці" title="Вітрина">
          <ExternalIcon />
        </a>
        <span className="console-top__me">
          <span className="console-avatar" aria-hidden="true">
            {initials || "?"}
          </span>
          <span>
            {me.displayName}
            <span className="console-top__role">{me.roles.includes("Admin") ? "Адміністратор" : "Менеджер"}</span>
          </span>
        </span>
        <button type="button" className="console-top__icon" onClick={onLogout} aria-label="Вийти" title="Вийти">
          <LogoutIcon />
        </button>
      </div>
    </header>
  );
}
