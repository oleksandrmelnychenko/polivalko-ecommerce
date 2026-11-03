"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLinks } from "../hooks/use-nav-links";
import { isCurrent, type Summary } from "../lib/nav";

export function SideBar({ summary }: { summary?: Summary }) {
  const pathname = usePathname();
  return (
    <aside className="admin-side">
      <div className="admin-side__brand">
        <Link href="/admin" className="logo" translate="no">
          PoliValko
        </Link>
        <span className="admin-side__tag">Адмінка</span>
      </div>
      <nav className="admin-side__nav" aria-label="Розділи адмінки">
        {useLinks().map((group) => (
          <div key={group.title} className="admin-side__group">
            <p className="admin-side__title">{group.title}</p>
            <ul>
              {group.links.map((l) => {
                const badge = summary && l.badge ? l.badge(summary) : 0;
                return (
                  <li key={l.href}>
                    <Link href={l.href} aria-current={isCurrent(l.href, pathname) ? "page" : undefined}>
                      {l.icon}
                      <span>{l.label}</span>
                      {badge > 0 && (
                        <span className="admin-side__badge" aria-label={`, потребують уваги: ${badge}`}>
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <p className="admin-side__foot">Сайт працює · прототип</p>
    </aside>
  );
}
