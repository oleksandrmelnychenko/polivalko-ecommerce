import type { ReactNode } from "react";
import { BagIcon, ClipboardIcon, FileTextIcon, GridIcon, ListIcon, PlugIcon, TagIcon, UserIcon, UsersIcon } from "@polivalko/shared/ui/icons";
import type { components } from "@polivalko/shared/api/schema";

export type Summary = components["schemas"]["ConsoleSummaryDto"];
export type NavLink = { href: string; label: string; icon: ReactNode; adminOnly: boolean; badge?: (s: Summary) => number };

export const groups: { title: string; links: NavLink[] }[] = [
  {
    title: "Продажі",
    links: [
      { href: "/", label: "Огляд", icon: <GridIcon />, adminOnly: false },
      { href: "/orders", label: "Замовлення", icon: <BagIcon />, adminOnly: false, badge: (s) => s.newOrders + s.awaitingConfirmation },
      { href: "/customers", label: "Покупці", icon: <UserIcon />, adminOnly: false },
      { href: "/requests", label: "Заявки", icon: <ClipboardIcon />, adminOnly: false, badge: (s) => s.newServiceRequests },
    ],
  },
  {
    title: "Магазин",
    links: [
      { href: "/catalog", label: "Каталог", icon: <TagIcon />, adminOnly: false },
      { href: "/content", label: "Контент", icon: <FileTextIcon />, adminOnly: true },
    ],
  },
  {
    title: "Система",
    links: [
      { href: "/integration", label: "Інтеграції", icon: <PlugIcon />, adminOnly: false, badge: (s) => s.failedOperations },
      { href: "/staff", label: "Працівники", icon: <UsersIcon />, adminOnly: true },
      { href: "/audit", label: "Журнал", icon: <ListIcon />, adminOnly: true },
    ],
  },
];

export const isCurrent = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
