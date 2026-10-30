"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BagIcon,
  BellIcon,
  ClipboardIcon,
  ExternalIcon,
  FileTextIcon,
  GridIcon,
  ListIcon,
  LogoutIcon,
  PlugIcon,
  SearchIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { csrfHeader, forgetCsrf, StaffGate, useAdminData, useStaff } from "@/lib/admin";
import { formatMoney } from "@/lib/format";
import { CommandPalette } from "./command-palette";

type Summary = components["schemas"]["AdminSummaryDto"];
type NavLink = { href: string; label: string; icon: ReactNode; adminOnly: boolean; badge?: (s: Summary) => number };

const groups: { title: string; links: NavLink[] }[] = [
  {
    title: "Продажі",
    links: [
      { href: "/admin", label: "Огляд", icon: <GridIcon />, adminOnly: false },
      { href: "/admin/orders", label: "Замовлення", icon: <BagIcon />, adminOnly: false, badge: (s) => s.newOrders + s.awaitingConfirmation },
      { href: "/admin/customers", label: "Покупці", icon: <UserIcon />, adminOnly: false },
      { href: "/admin/requests", label: "Заявки", icon: <ClipboardIcon />, adminOnly: false, badge: (s) => s.newServiceRequests },
    ],
  },
  {
    title: "Магазин",
    links: [
      { href: "/admin/catalog", label: "Каталог", icon: <TagIcon />, adminOnly: false },
      { href: "/admin/content", label: "Контент", icon: <FileTextIcon />, adminOnly: true },
    ],
  },
  {
    title: "Система",
    links: [
      { href: "/admin/integration", label: "Інтеграції", icon: <PlugIcon />, adminOnly: false, badge: (s) => s.failedOperations },
      { href: "/admin/staff", label: "Працівники", icon: <UsersIcon />, adminOnly: true },
      { href: "/admin/audit", label: "Журнал", icon: <ListIcon />, adminOnly: true },
    ],
  },
];

const isCurrent = (href: string, pathname: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

/** Лічильники для меню й дзвоника; оновлюються при кожному переході. */
const SummaryContext = createContext<{ summary?: Summary; reload: () => void }>({ reload: () => {} });
export const useSummary = () => useContext(SummaryContext);

/** Каркас адмінки: графітова бічна панель зі знаком у рамці, біла верхня смуга, сірий фон. */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <StaffGate fallback={<div className="admin-loading" aria-busy="true">Перевіряємо вхід…</div>}>
      <Shell>{children}</Shell>
    </StaffGate>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const summary = useAdminData(`shell-summary|${pathname}`, () => browserApi.GET("/api/v1/admin/summary"));
  return (
    <SummaryContext.Provider value={{ summary: summary.data, reload: summary.reload }}>
      <div className="admin-app">
        <SideBar summary={summary.data} />
        <div className="admin-body">
          <TopBar summary={summary.data} />
          <main id="main" className="admin-main">
            {children}
          </main>
        </div>
      </div>
    </SummaryContext.Provider>
  );
}

function useLinks() {
  const { isAdmin } = useStaff();
  return groups.map((g) => ({ ...g, links: g.links.filter((l) => isAdmin || !l.adminOnly) })).filter((g) => g.links.length > 0);
}

function SideBar({ summary }: { summary?: Summary }) {
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

function TopBar({ summary }: { summary?: Summary }) {
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

  async function logout() {
    await browserApi.POST("/api/v1/admin/auth/logout", { headers: await csrfHeader() });
    forgetCsrf();
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
        <button type="button" className="admin-top__icon" onClick={logout} aria-label="Вийти" title="Вийти">
          <LogoutIcon />
        </button>
      </div>
    </header>
  );
}

/** Дзвоник: що чекає на дію зараз, і три найсвіжіші нові замовлення. */
function Notifications({ summary }: { summary?: Summary }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const latest = useAdminData(`bell|${open}`, () =>
    open ? browserApi.GET("/api/v1/admin/orders", { params: { query: { status: "new", page: 1, pageSize: 3 } } }) : Promise.resolve({ data: undefined, response: new Response(null, { status: 204 }) }),
  );

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const rows = summary
    ? [
        { n: summary.newOrders, label: "нових замовлень", href: "/admin/orders?status=new", tone: "is-hot" },
        { n: summary.awaitingConfirmation, label: "чекають підтвердження", href: "/admin/orders?status=awaitingConfirmation", tone: "is-hot" },
        { n: summary.awaitingPayment, label: "чекають оплати", href: "/admin/orders?status=awaitingPayment", tone: "" },
        { n: summary.newServiceRequests, label: "нових заявок на послуги", href: "/admin/requests?status=new", tone: "is-hot" },
        { n: summary.pendingRefunds, label: "повернень в обробці", href: "/admin/orders", tone: "" },
        { n: summary.failedOperations, label: "невиконаних фонових операцій", href: "/admin/integration", tone: "is-bad" },
      ].filter((r) => r.n > 0)
    : [];
  const total = summary ? summary.newOrders + summary.awaitingConfirmation + summary.newServiceRequests + summary.failedOperations : 0;

  return (
    <div className="notify" ref={box}>
      <button
        type="button"
        className="admin-top__icon"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={total ? `Сповіщення: ${total}` : "Сповіщення"}
        onClick={() => setOpen((o) => !o)}
      >
        <BellIcon />
        {total > 0 && <span className="admin-top__dot">{total > 99 ? "99+" : total}</span>}
      </button>
      {open && (
        <div className="notify__panel" role="region" aria-label="Сповіщення">
          <p className="notify__head">
            Потребує уваги
            {summary && !summary.catalogDataFresh && <span className="chip chip--pink">Ціни застаріли</span>}
          </p>
          {rows.length === 0 ? (
            <p className="notify__empty">Усе оброблено. Нових подій немає.</p>
          ) : (
            <ul className="notify__list">
              {rows.map((r) => (
                <li key={r.label}>
                  <Link href={r.href} className={r.tone} onClick={() => setOpen(false)}>
                    <b>{r.n}</b>
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {latest.data && latest.data.items.length > 0 && (
            <>
              <p className="notify__head">Нові замовлення</p>
              <ul className="notify__list">
                {latest.data.items.map((o) => (
                  <li key={o.number}>
                    <Link href={`/admin/orders/${o.number}`} onClick={() => setOpen(false)}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="cell-strong">{o.number}</span>
                        <span className="cell-sub">{o.customerName}</span>
                      </span>
                      <span className="cell-strong">{formatMoney(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
