"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLinks } from "../hooks/use-nav-links";
import { isCurrent, type Summary } from "../lib/nav";

export function SideBar({ summary }: { summary?: Summary }) {
  const pathname = usePathname();
  return (
    <aside className="console-side">
      <div className="console-side__brand">
        <Link href="/" className="logo" translate="no">
          PoliValko
        </Link>
        <span className="console-side__tag">Консоль</span>
      </div>
      <nav className="console-side__nav" aria-label="Розділи консолі">
        {useLinks().map((group) => (
          <div key={group.title} className="console-side__group">
            <p className="console-side__title">{group.title}</p>
            <ul>
              {group.links.map((l) => {
                const badge = summary && l.badge ? l.badge(summary) : 0;
                return (
                  <li key={l.href}>
                    <Link href={l.href} aria-current={isCurrent(l.href, pathname) ? "page" : undefined}>
                      {l.icon}
                      <span>{l.label}</span>
                      {badge > 0 && (
                        <span className="console-side__badge" aria-label={`, потребують уваги: ${badge}`}>
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
      <p className="console-side__foot">Сайт працює · прототип</p>
    </aside>
  );
}
